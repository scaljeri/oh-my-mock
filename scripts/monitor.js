const chokidar = require("chokidar");
const { exec } = require("child_process");

let promise;
let timeoutId;
// One-liner for current directory
chokidar
  .watch([
    "./src/content",
    "./src/injected",
    "./src/background.ts",
    "./src/shared",
  ])
  .on("all", (event, path) => {
    console.log("---", event, path);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;

      if (promise) {
        promise.then(() => {
          promise = build()
            .catch(() => {})
            .finally(() => {
              promise = null;
              console.log("- finished delayed build");
            });
        });
      } else {
        promise = build()
          .catch(() => {})
          .finally(() => {
            promise = null;
            console.log("-finished build");
          });
      }
    }, 500);
  });

function build() {
  console.log("- start build");
  return new Promise((resolve, reject) => {
    exec("yarn build:both", (error, stdout, stderr) => {
      if (error) {
        console.log(`error: ${error.message}`);
        reject();
        return;
      }
      if (stderr) {
        console.log(`stderr: ${stderr}`);
        reject();
        return;
      }

      console.log(`stdout: ${stdout}`);
      resolve();
    });
  });
}
