const Nomad = require('nomad-stream')
const moment = require('moment')
const nomad = new Nomad()
const fetch = require('node-fetch')

let instance = null  // the nomad instance
const pollFrequency = 60 * 100000  // 1 hour
const url = 'http://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=5&alertlevel=yellow'

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
    return instance.publishRoot('Earthquake yellow alerts over the last 30 days')
  })
  .then(() => startPoll(pollFrequency))
  .catch(console.log)
