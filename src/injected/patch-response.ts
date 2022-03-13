// // Patch the Response object

// import { STORAGE_KEY } from "../shared/constants";
// import { findCachedResponse } from "./utils";

// let json: () => Promise<any>;

// export function patchResponse(): void {
//   json = Response.prototype.json;
// }

// export function unpatchResponse(): void {
//   if (json) {
//     window.Response.prototype.json = jsonFn;
//   }
// }

// function jsonFn(): Promise<any> {
//   return new Promise<any>(r => {
//     r(findCachedResponse());
//   });
// }
