![Master workflow](https://github.com/scaljeri/oh-my-mock/actions/workflows/master.yml/badge.svg)
![Feature workflow](https://github.com/scaljeri/oh-my-mock/actions/workflows/feature.yml/badge.svg)

![Buy me a coffee](https://raw.githubusercontent.com/scaljeri/oh-my-mock/feature/cypress/src/assets/images/bmac-btn.png)
## OhMyMock

OhMyMock is a [Chrome Extension](https://chrome.google.com/webstore/detail/oh-my-mock/egadlcooejllkdejejkhibmaphidmock) that can mock API responses in the browser. It works as follows:
The first time an API request is made it only caches the response, but the next time it will mock
the request and reply with the cached response. It is also possible to modify responses or status codes. 
This extension is especially useful for Frontend development and works well with frameworks like Angular, React or Vue.
OhMyMock can serve JSON, HTML, Images and a lot more.
Please make a feature request if you have a response which is not supported!!

There is an article on medium.com which describes OhMyMock in great detail [here](https://calje.medium.com/mock-api-responses-with-a-chrome-extension-called-ohmymock-875ac5d85999).

If you have the extension install you can see how it works with XMLHttpRequest and Fetch request on
the [demo page](https://scaljeri.github.io/oh-my-mock/).

By default OhMyMock is disabled and you need to enabled it, otherwise it will not cache or mock API
responses.

![alt text](https://github.com/scaljeri/oh-my-mock/blob/master/images/ohmymock-request-list.png?raw=true)
![alt text](https://github.com/scaljeri/oh-my-mock/blob/master/images/ohmymock-response-details.png?raw=true)

### Installation
OhMyMock can be install from the 
[chrome extension store](https://chrome.google.com/webstore/detail/oh-my-mock/egadlcooejllkdejejkhibmaphidmock), 
but you can also compile the source and use that instead if you like.
This is what you would do if you want to do OhMyMock develop. 

To install it from source checkout this repository and run the following commands

    $> yarn
    $> yarn build

The compiled code is stored in **"./dist"**

Navigate in Chrome to chrome://extensions and enable `development mode` and upload the **"./dist"** folder via the `Load unpacked` button. Thats it.

### Setup for development
First install all dependencies

    $> yarn

Start the development web server and watchers

    $> yarn watch

The test page will be available at http://localhost:8000

Everytime you hit save the project will rebuild, but after each rebuild you have to reload the extension and test page your self!

### Project structure
This project consists of a couple of different part, each with a specific task. Those parts are:

  * ./scripts           - Tooling
  * ./test-site         - Webserver (test/demo site)
  * ./libs/nodejs-sdk   - sdk for serving mocks from files
  * ./src/app           - angular app, the OhMyMock popup
  * ./src/content       - the extension content script, needed to pass messages between
                          the angular app and the injected script
  * ./src/injected      - this is where mocking takes place (e.g. patching of Fetch and XmlHttpRequest)
  * ./src/shared        - code shared between all parts
  * ./src/background    - the extension's background script

##### OhMyMock CDK
The cdk enables you to create a NodeJs server which connects with the chrome extension.
This allows you to serve responses in an easy way using a NodeJs server. This way it is
possible to serve file content as responses. If the server doesn't have a response for
a specific request, OhMyMock will then look in the cache and serve that if it exists.

##### background.js
For all tabs in the chrome browser there will be just one instance running of this script. It is
always active and when the OhMyMock icons is clicked it will open the OhMyMock popup (angular app). 
If you are using the OhMyMock SDK, the background script will establish the websocket connection. 

##### content script
Each tab has its own instance of the content script. It takes care of two things 
  
  1) Inject code into the context of the website
  2) It receives every request from the injected script. It is the task of the content script
     to find a mock (the response that will be served). This is a two step process:

     1) If there is a websocket connection (in case you use the SDK) the request is forwarded
        to the NodeJs. 
     2) If there is no websocket connection or the NodeJs doesn't serve a response, it looks
        inside the cached responses. 

##### injected script
The injected script remains dormant until OhMyMock is enabled.
If active it will patch window.fetch and window.XmlHttpRequest.
This way it is in full control of all requests.
When a request is made 3 things can happen:

   1) Every request is dispatched to the content script. If the content script doesn't find
      a response the call will pass through to the API. OhMyMock will cache the response.
   2) If there is a cached response, but it is not active, the call will pass through to the API.
   3) There is an active cache and it will be served as the response

Finally, if OhMyMock is disabled or the popup is closed, the original Fetch and XmlHttpRequest objects
are restored, as if nothing ever happend.

##### Angular app
The angular application is where you can interact with OhMyMock. Here you can see
which responses are cached, which are active, etc. Here you can also create responses manually.

<!--
## Core Team

<table border="0">
  <tr style="border:none">
    <td align="center">
      <a style="white-space:nowrap"
        href="https://github.com/scaljeri">
        <img style="max-width:100px" src="https://avatars2.githubusercontent.com/u/1078741?v=4" width="100px;" alt="Lucas Calje"/></br>
        <sub><b>Lucas Calje</b></sub>
      </a>
    </td>
    <td align="center">
      <a style="white-space:nowrap" 
         href="https://github.com/remco75">
        <img style="max-width:100px" src="https://avatars1.githubusercontent.com/u/5644903?v=4" width="100px;" alt="Remco Vlierman"/></br>
        <sub><b>Remco Vlierman</b></sub></a>
    </td>
  </tr>
</table> -->

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
     <td align="center"><a href="https://github.com/scaljeri"><img src="https://avatars2.githubusercontent.com/u/1078741?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Lucas Calje</b></sub></a>
    </td>
    <td align="center"><a href="https://github.com/imcuttle"><img src="https://avatars3.githubusercontent.com/u/13509258?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Cong Yu</b></sub></a>
    </td>
    <td align="center"><a href="https://github.com/plohoj"><img src="https://avatars3.githubusercontent.com/u/10156573?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Alexandr Plokhih</b></sub></a>
    </td>
  </tr>
  </table>


#### Known chrome issues
   * Manifest V3: webRequest listeners not called after service worker stops: https://bugs.chromium.org/p/chromium/issues/detail?id=1024211
   * MV3 content scripts need to add js in main world synchronously:  https://bugs.chromium.org/p/chromium/issues/detail?id=1207006
