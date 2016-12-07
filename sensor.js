const Nomad = require('nomad-stream')
const moment = require('moment')
const nomad = new Nomad()
const fetch = require('node-fetch')


let instance = null  // the nomad instance
const pollFrequency = 60 * 1000  // 60 seconds
const url = 'https://newsapi.org/v1/articles?source=reddit-r-all&sortBy=top&apiKey=827666c95cdc4d1486c8c225448decae'

function getMessage() {
  return fetch(url)
    .then(res => res.json())
    .then(json => JSON.stringify(json))
    .catch(err => {
      console.log('getMessage error: ', err)
      return err
    })
}

function startPoll(frequency) {
  setInterval(() => {
    getMessage()
      .then((m) => {
        console.log('fetched:', m)
        return instance.publish(m)
      })
      .catch(console.log)
  }, frequency)
}

nomad.prepareToPublish()
  .then((node) => {
    instance = node
    return instance.publishRoot('hello')
  })
  .then(() => startPoll(pollFrequency))
  .catch(console.log)
