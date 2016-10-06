import Beam from 'beam-client-node'
import storage from 'electron-json-storage'
import { remote } from 'electron'
import { actions as soundActions } from '../modules/Sounds'
const Interactive = remote.require('beam-interactive-node')
let Packets = remote.require('beam-interactive-node/dist/robot/packets').default
let robot
let running
let store

export const client = new Beam()
const oAuthOpts = {
  clientId: '50b52c44b50315edb7da13945c35ff5a34bdbc6a05030abe'
}
export const auth = client.use('oauth', oAuthOpts)

export function checkStatus () {
  console.log(auth.isAuthenticated()
  ? '########### User is Authenticated ###########'
  : '########### User Auth FAILED ###########')
  return auth.isAuthenticated()
}

export function requestInteractive (channelID, versionId) {
  return client.request('PUT', 'channels/' + channelID,
    {
      body: {
        interactive: true,
        interactiveGameId: versionId
      },
      json: true
    }
  )
}

export function getUserInfo () {
  return client.request('GET', '/users/current')
  .then(response => {
    return response
  })
}

export function updateTokens (tokens) {
  const newTokens = {
    access: tokens.access_token || tokens.access,
    refresh: tokens.refresh_token || tokens.refresh,
    expires: tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : tokens.expires
  }
  auth.setTokens(newTokens)
  storage.set('tokens', auth.getTokens())
}

/**
* Get's the controls of the interactive app running on a channel
* @param {string} channelID - The ID of the channel
*/
function getInteractiveControls (channelID) {
  return client.request('GET', 'interactive/' + channelID)
  .then(res => {
    return res.body.version.controls
  }, function () {
    throw new Error('Incorrect Version ID or Share Code in your config file')
  })
}

/**
 * Handles the report sent from Beam to us.
 * @param  {report} report - The report from Beam
 */
function handleReport (report) {
  if (running) {
    var tactileResults = []
    var isUpdate = false
    report.tactile.forEach(function (tac) {
      var isFired = false
      var prog = 0
      if (tac.pressFrequency > 0) {
        isUpdate = true
        isFired = true
        prog = 1
        console.log('Tactile: ' + tac.id + ', Press: ' +
                tac.pressFrequency + ', Release: ' + tac.releaseFrequency + ', Connected: ' + report.users.connected)
        store.dispatch(soundActions.playSound(tac.id))
      }
      var curCooldown
      var global
      if (global) {
        var tactile = new Packets.ProgressUpdate.TactileUpdate({
          id: tac.id,
          cooldown: curCooldown,
          fired: isFired,
          progress: prog
        })
        tactileResults.push(tactile)
      }
    })
    var progress = {
      tactile: tactileResults,
      joystick: [],
      state: 'default'
    }
    if (isUpdate && global) {
      robot.send(new Packets.ProgressUpdate(progress))
    }
  }
}

/**
 * Initialize and start Hanshake with Interactive app
 * @param {int} id - Channel ID
 * @param {Object} res - Result of the channel join
 */
function initHandshake (id) {
  return client.game.join(id)
  .then(function (details) {
    console.log('Authenticated with Beam. Starting Interactive Handshake.')
    details = details.body
    console.log('DETAILS', details)
    robot = new Interactive.Robot({
      remote: details.address,
      channel: id,
      key: details.key
    })
    return new Promise((resolve, reject) => {
      return robot.handshake(err => {
        if (err) {
          console.log(err)
          reject(err)
        } else {
          console.log('Connected')
          running = true
          resolve(robot)
        }
      })
    })
    .then(rb => {
      console.log('LETS GO')
      rb.on('report', handleReport)
      var count = 0
      rb.on('error', err => {
        if (count < 10) {
          count++
          throw err
        }
      })
    })
    .catch(err => {
      if (err.res) {
        throw new Error('Error connecting to Interactive:' + err.res.body.mesage)
      }
      throw new Error('Error connecting to Interactive', err)
    })
    // reconnector(robot, initHandshake.bind(this, id))
  })
}

export function goInteractive (channelId, versionId) {
  requestInteractive(channelId, versionId)
  .then(res => {
    console.log(res.body)
    if (res.body.interactiveGameId === 'You don\'t have access to that.') {
      throw Error('Permission Denied')
    } else {
      return getInteractiveControls(channelId)
    }
  })
  .then(res => {
    return initHandshake(channelId)
  })
  .catch(err => {
    console.log(err)
  })
}

/**
 * Stops the connection to Beam.
 */
export function stop () {
  if (robot !== null) {
    robot.close()
  }
}

export function setupStore (_store) {
  store = _store
}

export default {
  client,
  auth,
  checkStatus,
  requestInteractive,
  getUserInfo,
  updateTokens,
  goInteractive,
  setupStore
}