import Beam from 'beam-client-node'
import storage from 'electron-json-storage'
import { actions as soundActions } from '../modules/Sounds'
import { actions as interactiveActions } from '../modules/Interactive'
import { ipcRenderer } from 'electron'
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

export function requestStopInteractive (channelID, forcedDisconnect) {
  if (!forcedDisconnect) return new Promise ((resolve, reject) => { resolve(true) })
  return client.request('PUT', 'channels/' + channelID,
    {
      body: {
        interactive: false
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
  console.log(newTokens)
  auth.setTokens(newTokens)
  storage.set('tokens', auth.tokens)
}

export function getTokens () {
  return auth.getTokens()
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
 * Initialize and start Hanshake with Interactive app
 * @param {int} id - Channel ID
 * @param {Object} res - Result of the channel join
 */
function initHandshake (id) {
  return client.game.join(id)
  .then(function (details) {
    ipcRenderer.send('initHandshake', details, id)
  })
}

export function goInteractive (channelId, versionId) {
  return requestInteractive(channelId, versionId)
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
    robotClosedEvent()
  })
}

/**
 * Stops the connection to Beam.
 */
export function stopInteractive (channelId, forcedDisconnect) {
  return requestStopInteractive(channelId, forcedDisconnect)
  .then(() => {
    return new Promise ((resolve, reject) => {
      ipcRenderer.send('STOP_ROBOT')
      ipcRenderer.once('STOP_ROBOT', (event, err) => {
        if (err) reject(err)
        else resolve(true)
      })
    })
  })
}

export function setupStore (_store) {
  store = _store
}

export function setCooldown (_cooldownType, _staticCooldown, _cooldowns) {
  ipcRenderer.send('setCooldown', _cooldownType, _staticCooldown, _cooldowns)
}

function robotClosedEvent () {
  store.dispatch(interactiveActions.robotClosedEvent())
}

ipcRenderer.on('robotClosedEvent', function (event) {
  robotClosedEvent()
})

export default {
  client,
  auth,
  checkStatus,
  requestInteractive,
  getUserInfo,
  updateTokens,
  getTokens,
  goInteractive,
  stopInteractive,
  setupStore,
  setCooldown
}
