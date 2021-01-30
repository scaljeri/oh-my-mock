const path = require('path');
const mime = require('mime-types');

const appRouter = (app, fs) => {



  const usersPath = path.join(__dirname, '..', 'data', 'users.json');
  // READ
  app.get('/users', (req, res) => {
    fs.readFile(usersPath, 'utf8', (err, data) => {
      if (err) {
        throw err;
      }

      res.send(JSON.parse(data));
    });
  });


  app.get('/*', (req, res) => {
    const file = path.join(__dirname, '..', 'html', req.url);

    if (!res.getHeader('content-type')) {
      const charset = mime.charsets.lookup(path.extname(req.url));
      res.setHeader('Content-Type', charset);
    }

    res.sendFile(file);
  });
};

module.exports = appRouter;
