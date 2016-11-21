module.exports = {
  props: {'message': {type: String, default: 'Initializing...'}},
  template: '<div class="ice-status">' +
    '<strong>Status:</strong> ' +
    '<span class="ice-status-message" id="ice-status-message">{{message}}</span>' +
    '</div>'
}