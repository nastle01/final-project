const express = require('express');
const path = require('path');
const cookieSession = require('cookie-session');
const bcrypt = require('bcrypt');
const dbConnection = require('./database');
const { body, validationResult } = require('express-validator');
const app = express();
const server = require("http").Server(app);
const { v4: uuidv4 } = require("uuid");
const { ExpressPeerServer } = require("peer");


app.use(express.urlencoded({ extended: false }));
// SET OUR VIEWS AND VIEW ENGINE
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
//webcam
const opinions = {
    debug: true,
}

app.set("view engine", "ejs");
const io = require("socket.io")(server, { 
    cors: {
        origin: '*'
    }
});
app.get("/room", (req,res,next) => {
     let id = req.params.id;
     dbConnection.query("SELECT * FROM `users` ",[id])
     .then(([rows]) => {
        res.render('room',{name:rows[0].name,roomId: req.params.room});
     });
  });

// app.get("room/:room", (req, res) => {
//     res.render("room", { roomId: req.params.room });
// });

io.on("connection", (socket) => {
    socket.on("join-room", (roomId, userId, userName) => {
        socket.join(roomId);
        setTimeout(() => {
            socket.to(roomId).broadcast.emit("user-connected", userId);
        }, 1000)
        socket.on("message", (message) => {
            io.to(roomId).emit("createMessage", message, userName);
        });
    });
});



app.use("/peerjs", ExpressPeerServer(server, opinions));
app.use(express.static("public"));


app.use(express.urlencoded({extended:false}));

// APPLY COOKIE SESSION MIDDLEWARE
app.use(cookieSession({
    name: 'session',
    keys: ['key1', 'key2'],
    maxAge: 3600 * 1000 // 1hr
}));

// DECLARING CUSTOM MIDDLEWARE
const ifNotLoggedin = (req, res, next) => {
    if (!req.session.isLoggedIn) {
        return res.render('login');
    }
    next();
}
const ifLoggedin = (req, res, next) => {
    if (req.session.isLoggedIn) {
        return res.redirect('_header');
    }
    next();
}
// END OF CUSTOM MIDDLEWARE
// ROOT PAGE
app.get('/', ifNotLoggedin, (req, res, next) => {
    dbConnection.execute("SELECT `name` FROM `users` WHERE `id`=?", [req.session.userID])
        .then(([rows]) => {
            res.render('_header', {
                name: rows[0].name
            });
        });

});// btn
app.get("/login", (req, res) => {
    res.render("login");
});
app.get("/register", (req, res) => {
    res.render("register");
});

//Admin page
app.get("/admin", (req,res,next) => {
    dbConnection.query("SELECT * FROM `users` ",[req.session.userID])
    .then(([rows]) => {
        res.render('admin',{data:rows});
    });
  });

  app.get("/adminAction/edit/(:id)", (req,res,next) => {
    let id = req.params.id;
    dbConnection.query('SELECT * FROM users WHERE id = ?', [id], [res,req])
    .then(([rows]) => {
        res.render('adminAction/Edit',{data:rows[0]});
    });
  });
  app.post('/adminAction/edit/(:id)', 
  // post data validation(using express-validator)
  [
      body('user_email','Invalid email address!').isEmail().custom((value) => {
          return dbConnection.execute('SELECT email FROM users WHERE email=?', [value])
          .then(([rows]) => {
              if(rows.length > 0){
                  return Promise.reject('This E-mail already in use!');
              }
              return true;
          });
      }),
      body('user_name','Username is Empty!').trim().not().isEmpty(),
      body('user_pass','The password must be of minimum length 6 characters').trim().isLength({ min: 6 }),
  ],// end of post data validation
  (req,res,next) => {
  
      const validation_result = validationResult(req);
      const {user_name, user_pass,user_email,id} = req.body;
      // IF validation_result HAS NO ERROR
      if(validation_result.isEmpty()){
          // password encryption (using bcryptjs)
          bcrypt.hash(user_pass, 12).then((hash_pass) => {
              // INSERTING USER INTO DATABASE
              dbConnection.query("UPDATE users SET name = ?, email = ?, password = ? WHERE id = "+ id,[user_name,user_email, hash_pass])
              .then(result => {
                  res.send(`<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css">
                  <center><br><br>your account has been created successfully, Now you can <br><br>
                  <a href="/admin" class="btn btn-primary">Login</a></center>`);
              }).catch(err => {
                  // THROW INSERTING USER ERROR'S
                  if (err) throw err;
              });
          })
          .catch(err => {
              // THROW HASING ERROR'S
              if (err) throw err;
          })
      }
  
  });

  
  app.get("/adminAction/add", (req,res,next) => {
    let id = req.params.id;
    dbConnection.query('SELECT * FROM users WHERE id = ?', [id], [res,req])
    .then(([rows]) => {
        res.render('adminAction/add',{data:rows[0]});
    });
  });
  app.post('/adminAction/add', 
  // post data validation(using express-validator)
  [
      body('user_email','Invalid email address!').isEmail().custom((value) => {
          return dbConnection.execute('SELECT email FROM users WHERE email=?', [value])
          .then(([rows]) => {
              if(rows.length > 0){
                  return Promise.reject('This E-mail already in use!');
              }
              return true;
          });
      }),
      body('user_name','Username is Empty!').trim().not().isEmpty(),
      body('user_pass','The password must be of minimum length 6 characters').trim().isLength({ min: 6 }),
  ],// end of post data validation
  (req,res,next) => {
  
      const validation_result = validationResult(req);
      const {user_name, user_pass,user_email,id} = req.body;
      // IF validation_result HAS NO ERROR
      if(validation_result.isEmpty()){
          // password encryption (using bcryptjs)
          bcrypt.hash(user_pass, 12).then((hash_pass) => {
              // INSERTING USER INTO DATABASE
              dbConnection.execute("INSERT INTO `users`(`name`,`email`,`password`) VALUES(?,?,?)", [user_name, user_email, hash_pass])
              .then(result => {
                  res.send(`<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css">
                  <center><br><br>your account has been created successfully, Now you can <br><br>
                  <a href="/admin" class="btn btn-primary">Login</a></center>`);
              }).catch(err => {
                  // THROW INSERTING USER ERROR'S
                  if (err) throw err;
              });
          })
          .catch(err => {
              // THROW HASING ERROR'S
              if (err) throw err;
          })
      }
  
  });

  app.get('/delete/(:id)', (req, res) => {
    let id = req.params.id;
        dbConnection.query('DELETE FROM users WHERE id = ?', [id], [res,req])
        .then(([rows]) => {
            res.redirect('/admin');
        }); 
        });
// REGISTER PAGE
app.post('/register', ifLoggedin,
    // post data validation(using express-validator)
    [
        body('user_email', 'Invalid email address!').isEmail().custom((value) => {
            return dbConnection.execute('SELECT `email` FROM `users` WHERE `email`=?', [value])
                .then(([rows]) => {
                    if (rows.length > 0) {
                        return Promise.reject('This E-mail already in use!');
                    }
                    return true;
                });
        }),
        body('user_name', 'Username is Empty!').trim().not().isEmpty(),
        body('user_pass', 'The password must be of minimum length 6 characters').trim().isLength({ min: 6 }),
    ],// end of post data validation
    (req, res, next) => {

        const validation_result = validationResult(req);
        const { user_name, user_pass, user_email } = req.body;
        // IF validation_result HAS NO ERROR
        if (validation_result.isEmpty()) {
            // password encryption (using bcryptjs)
            bcrypt.hash(user_pass, 12).then((hash_pass) => {
                // INSERTING USER INTO DATABASE
                dbConnection.execute("INSERT INTO `users`(`name`,`email`,`password`) VALUES(?,?,?)", [user_name, user_email, hash_pass])
                    .then(result => {
                        res.send(`your account has been created successfully, Now you can <a href="/">Login</a>`);
                    }).catch(err => {
                        // THROW INSERTING USER ERROR'S
                        if (err) throw err;
                    });
            })
                .catch(err => {
                    // THROW HASING ERROR'S
                    if (err) throw err;
                })
        }
        else {
            // COLLECT ALL THE VALIDATION ERRORS
            let allErrors = validation_result.errors.map((error) => {
                return error.msg;
            });
            // REDERING login-register PAGE WITH VALIDATION ERRORS
            res.render('login-register', {
                register_error: allErrors,
                old_data: req.body
            });
        }
    });// END OF REGISTER PAGE


// LOGIN PAGE
app.post('/', ifLoggedin, [
    body('user_email').custom((value) => {
        return dbConnection.execute('SELECT email FROM users WHERE email=?', [value])
            .then(([rows]) => {
                if (rows.length == 1) {
                    return true;

                }
                return Promise.reject('Invalid Email Address!');

            });
    }),
    body('user_pass', 'Password is empty!').trim().not().isEmpty(),
], (req, res) => {
    const validation_result = validationResult(req);
    const { user_pass, user_email } = req.body;
    if (validation_result.isEmpty()) {

        dbConnection.execute("SELECT * FROM `users` WHERE `email`=?", [user_email])
            .then(([rows]) => {
                bcrypt.compare(user_pass, rows[0].password).then(compare_result => {
                    if (compare_result === true) {
                        req.session.isLoggedIn = true;
                        req.session.userID = rows[0].id;

                        res.redirect('/');
                    }
                    else {
                        res.render('login', {
                            login_errors: ['Invalid Password!']
                        });
                    }
                })
                    .catch(err => {
                        if (err) throw err;
                    });


            }).catch(err => {
                if (err) throw err;
            });
    }
    else {
        let allErrors = validation_result.errors.map((error) => {
            return error.msg;
        });
        // REDERING login-register PAGE WITH LOGIN VALIDATION ERRORS
        res.render('login', {
            login_errors: allErrors
        });
    }
});
// END OF LOGIN PAGE
//webcam

// LOGOUT
app.get('/logout', (req, res) => {
    //session destroy
    req.session = null;
    res.redirect('/');
});
// END OF LOGOUT

app.use('/', (req, res) => {
    res.status(404).send('<h1>404 Page Not Found!</h1>');
});



server.listen(3000, () => console.log("Server is Running..."));