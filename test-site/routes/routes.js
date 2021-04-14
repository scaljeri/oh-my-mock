const path = require("path");
const mime = require("mime-types");

const appRouter = (app, fs) => {
  const usersPath = path.join(__dirname, "..", "data", "users.json");
  const sitePath = path.join(__dirname, "..", "data", "site.html");
  // READ
  app.get("/users", (req, res) => {
    setTimeout(() => {
      fs.readFile(usersPath, "utf8", (err, data) => {
        if (err) {
          throw err;
        }

        res.contentType('application/json');
        res.send(data);
      });
    }, 1000);
  });

  app.get("/site", (req, res) => {
    setTimeout(() => {
      fs.readFile(sitePath, "utf8", (err, data) => {
        if (err) {
          throw err;
        }

        res.contentType('text/html');
        res.send(data);
      });
    }, 2000);
  });

  app.post('/users', (req,res) => {
     res.contentType('application/json');
     res.end(JSON.stringify({msg: 'success'}));
  });

  app.get("/*", (req, res) => {
    const file = path.join(__dirname, "..", "html", req.url);

    if (!res.getHeader("content-type")) {
      const charset = mime.charsets.lookup(path.extname(req.url));
      res.setHeader("Content-Type", charset);
    }

    res.sendFile(file);
  });
};

module.exports = appRouter;
