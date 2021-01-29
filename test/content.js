console.log('test');

// chrome.runtime.onMessage.addListener(
//   function(request, sender, sendResponse) {
//     console.log('received msg', request);
//     sendResponse({ code: 9});
//   }
// );

// chrome.runtime.sendMessage({
//   msg: 'connect'
// }, (response) => {
//   console.log('response: ', response);
// });

function testMessage() {
  setChildTextNode("resultsRequest", "running...");

  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    var timer = new chrome.Interval();
    timer.start();
    var tab = tabs[0];
    chrome.tabs.sendMessage(tab.id, {counter: 1}, function handler(response) {
      if (response.counter < 1000) {
        chrome.tabs.sendMessage(tab.id, {counter: response.counter}, handler);
      } else {
        timer.stop();
        var usec = Math.round(timer.microseconds() / response.counter);
        setChildTextNode("resultsRequest", usec + "usec");
      }
    });
  });
}

function buildScriptTag(id) {
  const xhrScript = document.createElement('script');
  xhrScript.id = id;
  xhrScript.type = 'text/javascript';
  xhrScript.onload = function() {
    console.log('XXXXXXXX', this.remove);
    this.remove();
  }
  xhrScript.src = chrome.runtime.getURL('injected-script.js');
  return xhrScript;
}

window.addEventListener("message", ev => {
    ev.data.message && console.log('ContentScript: message in injected script', ev.data.message);
});

if (document.head && document.body) {
  const script = buildScriptTag('oh-my-xml-mock');
  // script.innerHTML = `
  //   const el = document.createElement('div');
  //   el.id = 'oh-my-mock-data';
  //   el.innerText = '{"x": 10}';
  //   console.log(el);
  //   document.body.appendChild(el);
  //   window.addEventListener('message', (ev)=> {
  //       ev.data.message && console.log('Site: received msg: ', ev.data);
  //   });
  //   setTimeout(() => {
  //     el.innerText = '{"x": 20 }';
  //     window.postMessage({message: {"x": 20 }});
  //   }, 5000);
  // `;

  document.head.prepend(script);

  setTimeout(() => {
  const output = document.querySelector('#oh-my-mock-data');
  console.log('output:', JSON.parse(output.innerText));

  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
         console.log("Data changed", JSON.parse(mutation.target.innerText));
    });
  });

  observer.observe(output, { childList: true });
  }, 1000);

  window.postMessage({ message: "injectedpagescript.js loaded"}, "*");

}



// var _open = XMLHttpRequest.prototype.open;
// window.XMLHttpRequest.prototype.open = function (method, URL) {
//     var _onreadystatechange = this.onreadystatechange,
//     _this = this;

//     _this.onreadystatechange = function () {
//         // catch only completed 'api/search/universal' requests
//         if (_this.readyState === 4 && _this.status === 200 && ~URL.indexOf('api/search/universal')) {
//             try {
//                 //////////////////////////////////////
//                 // THIS IS ACTIONS FOR YOUR REQUEST //
//                 //             EXAMPLE:             //
//                 //////////////////////////////////////
//                 var data = JSON.parse(_this.responseText); // {"fields": ["a","b"]}

//                 if (data.fields) {
//                     data.fields.push('c','d');
//                 }

//                 // rewrite responseText
//                 Object.defineProperty(_this, 'responseText', {value: JSON.stringify(data)});
//                 /////////////// END //////////////////
//             } catch (e) {}

//             console.log('Caught! :)', method, URL/*, _this.responseText*/);
//         }
//         // call original callback
//         if (_onreadystatechange) _onreadystatechange.apply(this, arguments);
//     };

//     // detect any onreadystatechange changing
//     Object.defineProperty(this, "onreadystatechange", {
//         get: function () {
//             return _onreadystatechange;
//         },
//         set: function (value) {
//             _onreadystatechange = value;
//         }
//     });

//     return _open.apply(_this, arguments);
// };


