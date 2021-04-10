![Master workflow](https://github.com/scaljeri/oh-my-mock/actions/workflows/master.yml/badge.svg)
![Feature workflow](https://github.com/scaljeri/oh-my-mock/actions/workflows/feature.yml/badge.svg)

OhMyMock is a Chrome Extension that mocks API calls. It can mock XmlHttpRequest and Fetch 
requests. As soon as OhMyMock is enabled it will start caching API responses but it will not
mock requests by default. Via the OhMyMock UI you have to enable mocking per response/request.

There is an article on medium.com which describes OhMyMock in more detail [here](https://medium.com/p/875ac5d85999/edit).

### Installation
OhMyMock can be install from the 
[chrome extension store](https://chrome.google.com/webstore/detail/oh-my-mock/egadlcooejllkdejejkhibmaphidmock), 
but you can also compile the source and use that instead if you like. This is what you would do if you want to do OhMyMock develop. 
To install it from source checkout this repository and run the following commands

    $> yarn
    $> yarn build

The compiled code is stored in **"./dist"**

Navigate in Chrome to chrome:extensions and enable `development mode` and upload the **"./dist"** folder via the `Load unpacked` button. Thats it.

### Setup development
First install all dependencies

    $> yarn

Start the development web server

    $> yarn start:server

The test page will be available at http://localhost:8000

Finally start the build in watch mode

    $> yarn build:watch

Everytime you hit save the project will rebuild, but after each rebuild you have to reload the extension and test page your self!

### Project structure
This project consists of a couple of different part, each with a specific task. Those parts are:

  * ./scripts           - Tooling
  * ./test-site         - Webserver (test/demo site)
  * ./src/app           - angular app, the OhMyMock popup
  * ./src/content       - the extension content script, needed to pass messages between
                          the angular app and the injected script
  * ./src/injected      - this is where mocking takes place (e.g. patching of Fetch and XmlHttpRequest)
  * ./src/shared        - code shared between all parts
  * ./src/background.ts - the extension's background script

##### background.js
For all tabs in the chrome browser there will be just one instance running of this script. It is
always active and when the OhMyMock icons is clicked it will open the OhMyMock popup (angular app). 
Its other taks is to pass messages from the popup to the content script. Messages send from the 
content script go straight to the popup. 

##### content script
Each tab has its own instance of the content script. It takes care of 2 things, 1) inject code into the context of the website and 2) communicate between popup/background and injected script. 

##### injected script
The injected script remains dormant until OhMyMock is enabled. If active it will patch window.fetch 
and window.XmlHttpRequest. This way it is in full control of all requests. When a reuqest is made 3
things can happen:

   1) There is no cached response and the call will pass through to the API. OhMyMock will cache
      the response.
   2) There is a cached response, but it is not active and the call will pass through to the API
   3) There is an active cache and it will be served as the response

Finally, if OhMyMock is disabled or the popup is closed, the original Fetch and XmlHttpRequest objects
are restored, as if nothing ever happend.

##### Angular app
The angular application is where you can interact with OhMyMock. This is where OhMyMock persists 
responses, allow you to modified responses and headers, created new ones and a lot more.
