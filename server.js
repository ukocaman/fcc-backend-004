const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.Promise = global.Promise
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track', {useMongoClient: true})

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// User schema & model
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    // unique: true
  },
  exercises: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' }]
})
const User = mongoose.model('User', userSchema);

// Exercise schema & model
const exerciseSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  // userId: { // 
  //   type: String,
  //   required: true,
  // },
  description: {
    type: String,
    required: true,
  },
  duration: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  }
})
const Exercise = mongoose.model('Exercise', exerciseSchema);

// POST /api/exercise/new-user #create user
app.post('/api/exercise/new-user', (req, res, next) => {
  const username = req.body.username
  if(username) {
    User.findOne({ username })
    .then(user => {
      if(user) { // user already exists
        const { _id, username } = user
        res.json({ username, _id })
      } else { // new user
        new User({ username })
        .save()
        .then(user => {
          const { _id, username } = user
          res.json({ username, _id })
        })  
      }
    })
  } else {
    next()
  }
})

// GET /api/exercise/users #index users
app.get('/api/exercise/users', (req, res) => {
  User.find()
  .then(users => {
    users = users.map(user => ({ id: user.id, username: user.username }))
    res.json({ users })
    
  })
})

// POST /api/exercise/add #create exercise
app.post('/api/exercise/add', (req, res, next) => {
  let { userId, description, duration, date } = req.body
  if(!date) {
    date = new Date(Date.now()).toISOString().slice(0, 10)
  }
  
  if(!userId || !description || !duration) { 
    next()
  } else {
    User.findById(userId)
    .then(user => {
      if(user) {
        new Exercise({ userId, description, duration, date })
        .save()
        .then(exercise => { // add exercise to the user as well
          user.exercises = [...user.exercises, exercise._id]
          user.save()
          .then(user => {
            const { description, duration, date } = exercise
            res.json({ user: user.username, description, duration, date })
          })
        })
      } else { // no such user
        res.send('No such user')
      }
    })
    .catch(err => next(err))
  }
})

// GET /api/exercise/log?{userId}[&from][&to][&limit]
app.get('/api/exercise/log', (req, res, next) => {
  let { userId, from, to, limit } = req.query
  if(!userId) {
    next()
  } else {
    User.findById(userId).populate('exercises')
    .then(user => {
      if(!user) {
        res.json('No such user!')
      } else {
        let { username, exercises } = user    
        let log = exercises.map(ex => ({ description: ex.description, duration: ex.duration, date: ex.date }))
        if(from && to) {
          log = log.filter(ex => Date.parse(ex.date) >= Date.parse(from) && Date.parse(ex.date) <= Date.parse(to))
        }
        if(limit) {
          log = log.slice(0, parseInt(limit))
        }
        res.json({ username, count: log.length, log })
      }
    })
    .catch(err => next(err))
    
  }
})

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
