module.exports = {
  props: ['variable', 'colorScale'],
  template: '<div class="ice-legend">' +
      '<p>hello variable: {{variable}}</p>' +
    '</div>',
  mounted: function () {
    console.log('iceLegend:mounted');
    var vm = this;
  },
  watch: {
    variable: function () {
      console.log('iceLegend:watch variable');
      // this.render();
    }
  },
  methods: {
    render: function () {
      console.log('iceLegend:render()');
      var vm = this;
    }
  }
}
