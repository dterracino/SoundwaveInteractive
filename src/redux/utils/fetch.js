require('es6-promise').polyfill()
import fetch from 'isomorphic-fetch'
import config from '../../../package.json'

function get (uri, data, headers = {}) {
  headers = setHeaders(headers)
  return fetch(uri, { method: 'GET', headers: headers })
  .catch(requestError)
  .then(res => handleResponse(res))
}

function post (uri, data, headers = {}) {
  headers = setHeaders(headers)
  return fetch(uri, { method: 'POST', headers: headers, body: JSON.stringify(data) })
  .catch(requestError)
  .then(res => handleResponse(res))
}

function put (uri, data, headers = {}) {
  headers = setHeaders(headers)
  return fetch(uri, { method: 'PUT', headers: headers, body: data ? JSON.stringify(data) : '' })
  .catch(requestError)
  .then(res => handleResponse(res))
}

function handleResponse (res) {
  console.log(res)
  if (res.status === 200) return res.json()
  else {
    const error = new Error('HTTP Status: ' + res.status + ' ' + res.statusText)
    error.response = res
    throw error
  }
}

function requestError (err) {
  console.log(err)
  throw err
}

function setHeaders (headers) {
  headers['Accept'] = 'application/json'
  headers['Content-Type'] = 'application/json'
  headers['X-Auth-Token'] = localStorage.getItem('si-token') || ''
  headers['X-App-Version'] = config.version
  return headers
}

export default {
  get,
  post,
  put
}
