/**
 * Keeps the full reset apart from everything else the background is doing.
 *
 * `clearStore()` puts the wipe in the store's write queue, and that settles the
 * *store record*: a change already in flight cannot land after the clear and
 * write the record back with the domains it read beforehand. It settles nothing
 * else. States, requests, mocks and cookie mocks are records of their own, and
 * they are deliberately written outside that queue — a state is written on every
 * aux change, every filter keystroke and every intercepted request, and a queue
 * turn apiece would cost a group pass apiece.
 *
 * `OhMyQueue` keeps one lane per `payloadType`, so STATE, REQUEST, RESPONSE,
 * REMOVE, COOKIE, HITS and UPSERT all run *concurrently by construction*. Each
 * of them is a read, some awaits, and a write. A wipe running beside them lands
 * in the middle: the write completes after `chrome.storage.local.clear()` and
 * leaves a record the rebuilt store does not list — a state for a domain the
 * store no longer knows, requests no state names, mocks no request names. They
 * are invisible on every screen and nothing ever collects them, because nothing
 * here deletes a record it cannot prove is stray.
 *
 * ## Why quiet rather than a generation counter
 *
 * The alternative was to stamp every write with the storage generation it was
 * decided in and drop the ones from before the wipe. It needs the generation
 * carried from where a unit of work *starts* to where it writes, across every
 * await in between — and the web has no async context to carry it in. That
 * means threading it through `StorageUtils.set`, `importJSON`, both handlers
 * that write a record and both that delete one; every place that forgets to
 * thread it is a hole that looks exactly like working code.
 *
 * So the wipe waits for quiet instead, and — the part that makes it a fix
 * rather than a narrower window — holds it. `notWhileWiping` is the door every
 * unit of background work comes in through, and it is shut for the whole wipe.
 *
 * ## Why the door is at the intake and not around each handler
 *
 * Handlers queue packets *at* each other and wait for them: the response
 * handler waits on a REQUEST packet, the request handler and the remove handler
 * on a STATE patch. Shutting the door in front of those inner packets would
 * deadlock — the outer handler would hold its lane open waiting for a packet
 * the barrier is refusing to start, and the wipe would wait for that lane
 * forever. Inner packets are therefore never gated: they belong to a unit of
 * work that came through the door before it shut, and quiet is not declared
 * until they too have run.
 */
import { ohPacketType } from '../shared/utils/queue';

/**
 * As much of `OhMyQueue` as this needs.
 *
 * Structural rather than `OhMyQueue`, whose item type is part of it: the
 * background's queue carries `IPacket`, a test's carries whatever it likes, and
 * quiet does not depend on either.
 */
export interface IOhMyQuietable {
  isIdle(except?: ohPacketType): boolean;
  whenIdle(except?: ohPacketType): Promise<void>;
}

let queue: IOhMyQuietable | undefined;
let wipeLane: ohPacketType | undefined;

/**
 * Says which queue has to fall quiet, and which lane the wipe runs in.
 *
 * The lane is excluded from "quiet" because the wipe is dispatched as a packet
 * like any other — see `isIdle`.
 */
export function wipesRunOn(onQueue: IOhMyQuietable, lane: ohPacketType): void {
  queue = onQueue;
  wipeLane = lane;
}

/** The wipe in progress, if there is one. Chained, so two resets never overlap. */
let wiping: Promise<unknown> | undefined;

/** Units of work that came through the door and have not finished. */
let running = 0;
let waitingForQuiet: (() => void)[] = [];

function settle(): void {
  if (running === 0) {
    // Spliced out first: a resolved waiter must not be called twice if one of
    // them synchronously starts something that lands back in here.
    waitingForQuiet.splice(0).forEach(resolve => resolve());
  }
}

function untilNothingIsRunning(): Promise<void> {
  return running === 0
    ? Promise.resolve()
    : new Promise<void>(resolve => waitingForQuiet.push(resolve));
}

/**
 * Runs `work` as a unit of background work that a wipe must not cut through.
 *
 * Every way into the background wraps its work in this: the message queue's
 * intake, the cookie recorder's `chrome.cookies.onChanged` listener, and the
 * worker's own start-up. A wipe in progress holds it at the door; a wipe that
 * starts while it runs waits for it.
 *
 * `lane` is the queue lane a packet will run in, where there is one. The wipe's
 * own lane goes straight through, uncounted: a reset held at the door would be
 * waiting for the wipe it is about to start, and a reset *counted* as work would
 * make that wipe wait for the very packet it came in on. The rule lives here
 * rather than at the intake because it is the barrier's own — the intake
 * knowing when to skip the barrier is exactly the kind of thing that gets lost
 * the next time that subscriber is rewritten.
 */
export function notWhileWiping<T>(work: () => Promise<T>, lane?: ohPacketType): Promise<T> {
  if (lane !== undefined && lane === wipeLane) {
    return work();
  }

  return (async () => {
    // `while`, not `if`: a second reset can be queued behind the first, and
    // this has to wait out every one of them.
    while (wiping) {
      const current = wiping;

      await current;

      // The *same* promise still parked here after it settled means the wipe
      // finished without clearing up after itself. Waiting on it again is not
      // waiting at all — an already-settled promise resolves in the next
      // microtask, so the loop would spin on it and never yield to the event
      // loop at all: no timer fires, no storage callback runs, and the service
      // worker burns a core until it is killed. Found the hard way, by a
      // mutation that stopped the clearing and turned this into a 53-minute
      // 99%-CPU hang rather than the failing test it was meant to be.
      //
      // The wipe is genuinely over by then — the promise settled — so going on
      // is what the working code does anyway. This only decides how the barrier
      // behaves when the bookkeeping below is broken: let the work through,
      // rather than take the worker down with it.
      if (wiping === current) {
        break;
      }
    }

    // Counted before `work` reaches its first `await` — an async function body
    // runs synchronously up to that point — so there is no turn in which this
    // has started and a wipe cannot see it.
    running++;

    try {
      return await work();
    } finally {
      running--;
      settle();
    }
  })();
}

/**
 * Runs `work` — the wipe and the rebuild that follows it — with nothing else
 * going on.
 *
 * The door is shut before anything is awaited, then the work already inside is
 * waited out, and only then does the wipe run. The rebuild (`initStorage` and
 * the demo import) is deliberately inside: it writes records too, and letting
 * messages back in between the clear and the rebuild would hand the extension
 * out in a state with no store to speak of.
 */
export function wipeExclusively<T>(work: () => Promise<T>): Promise<T> {
  const previous = wiping ?? Promise.resolve();

  const run = (async () => {
    // A second reset waits for the first rather than interleaving with it — and
    // it waits for the *rebuild* too, so it never clears a half-built store.
    await previous;
    await quiet();

    return work();
  })();

  // The chain has to survive a failing wipe; the failure itself still belongs
  // to that wipe's caller, which gets it through `run`.
  const mine: Promise<void> = run.catch(() => undefined).then(() => {
    // Only this wipe is over. A reset queued behind it has already put its own
    // promise here, and clearing that would open the door for the gap between
    // the two.
    if (wiping === mine) {
      wiping = undefined;
    }
  });

  // Assigned in the same turn as the call, before `run` can have got past its
  // first `await`. Anything reaching `notWhileWiping` from here on waits.
  wiping = mine;

  return run;
}

/**
 * Waits for every lane and every tracked unit of work to fall quiet.
 *
 * Both, and re-checked in a loop, because they are separate events: a handler
 * can queue a state patch and return without waiting for it (the cookie handler
 * does), so the packet outlives the unit that sent it and shows up only in the
 * queue's own idleness. The loop terminates because the door is already shut —
 * nothing new can start, and what is running can only queue packets while it is
 * still running, which is to say while the queue is not idle anyway.
 */
async function quiet(): Promise<void> {
  while (running > 0 || !(queue?.isIdle(wipeLane) ?? true)) {
    await Promise.all([untilNothingIsRunning(), queue?.whenIdle(wipeLane)]);
  }
}

/** Drops the barrier's state — a teardown, for tests. */
export function forgetWipes(): void {
  wiping = undefined;
  running = 0;
  waitingForQuiet = [];
  queue = undefined;
  wipeLane = undefined;
}
