![example workflow](https://github.com/scaljeri/oh-my-mock/actions/workflows/ci.yml/badge.svg)

### setup development

    $> yarn build:watch

#### Dataflow

##### background.js
This script opens the new tab containing the angular application. 

##### content.js
If the extension is enabled, this script will run on any tab.
This script injects the `injected.js` and communicates with the angular application (via background.js).
This script communicates with the injected script via window.message/window.addMessage

##### injected.js
If the extension is enabled, this script will run on any tab, but it will not save or mock
responses until OhMyMock is enabled. But if it is enabled it will mocks XHR calls. Based on state 
it can pass through XHR calls or mock responses 

##### Angular app
Display of the chrome extension. If the state changes, `content.service.js` directly sends data to 
`content.js`

### Sources
  * https://medium.com/angular-in-depth/chrome-extension-with-angular-why-and-how-778200b87575
  * https://github.com/Pasupathi-Rajamanickam/chrome-response-override
  * https://www.youtube.com/watch?v=ew9ut7ixIlI&list=PLRqwX-V7Uu6bL9VOMT65ahNEri9uqLWfS&index=4&ab_channel=TheCodingTrain
  * https://github.com/GoogleChrome/chrome-extensions-samples/blob/master/api/messaging/timer/popup.js
  * https://github.com/ngneat/hot-toast

 

