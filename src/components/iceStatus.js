module.exports = {
  props: {'message': {type: String, default: 'Initializing...'}},
  template: '<div class="ice-status">' +
    '<i class="fa fa-spinner fa-spin fa-fw"></i> ' +
    '<span class="ice-status-message" id="ice-status-message">{{message}}</span>' +
    '</div>'
}