module.exports = {
  props: ['id', 'getDim'],
  template: '<div class="ice-filter">' +
    '<strong>ID:</strong> ' +
    '{{id}}' +
    '</div>',
  mounted: function () {
    console.log('filter(' + this.id + '):mounted');
  },
  updated: function () {
    console.log('filter(' + this.id + '):updated');
  },
  destroyed: function () {
    console.log('filter(' + this.id + '):destroyed');
  }
}
