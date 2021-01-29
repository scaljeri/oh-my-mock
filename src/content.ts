console.log('---------- CONTENT SCRIPT STARTED -------------');

window['xyz'] = 9;
alert('x');
// var _open = XMLHttpRequest.prototype.open;
// window.XMLHttpRequest.prototype.open = function (method, URL) {
//   var _onreadystatechange = this.onreadystatechange,
//     _this = this;

//   _this.onreadystatechange = function () {
//     // catch only completed 'api/search/universal' requests
//     if (_this.readyState === 4 && _this.status === 200) { // && ~URL.indexOf('api/search/universal')) {
//       try {
//         //////////////////////////////////////
//         // THIS IS ACTIONS FOR YOUR REQUEST //
//         //             EXAMPLE:             //
//         //////////////////////////////////////
//         var data = JSON.parse(_this.responseText); // {"fields": ["a","b"]}

//         // if (data.fields) {
//         //   data.fields.push('c', 'd');
//         // }
//         console.log('Mock:', URL, data);

//         // rewrite responseText
//         Object.defineProperty(_this, 'responseText', { value: JSON.stringify(data) });
//         /////////////// END //////////////////
//       } catch (e) { }

//       console.log('Caught! :)', method, URL/*, _this.responseText*/);
//     }
//     // call original callback
//     if (_onreadystatechange) _onreadystatechange.apply(this, arguments);
//   };

//   // detect any onreadystatechange changing
//   Object.defineProperty(this, "onreadystatechange", {
//     get: function () {
//       return _onreadystatechange;
//     },
//     set: function (value) {
//       _onreadystatechange = value;
//     }
//   });

//   return _open.apply(_this, arguments);
// };

// chrome.runtime.onMessage.addListener(
  // function(request, sender, sendResponse) {
//     console.log('xhr call msg', request);
//     sendResponse({ code: 9});
//   }
// );

// chrome.runtime.sendMessage({
//   msg: 'connect'
// }, (response) => {
//   console.log('response: ', response);
// });
