module.exports = {
  props: ['featureType', 'feature'],
  template: '<div class="ice-select-info text-right">' +
      '<div class="ice-select-info-title"><strong>Selected {{featureType}}:</strong> <span>{{featureLabel}}</span></div>' +
      '<div class="btn-group btn-group-xs" style="margin-top:5px">' +
        '<button class="btn btn-default disabled"><i class="fa fa-info"></i> Info</button>' +
        '<button class="btn btn-default" @click="zoom"><i class="fa fa-search-plus"></i> Catchments</button>' +
        '<button class="btn btn-default" @click="unselect"><i class="fa fa-times-circle"></i> Unselect</button>' +
      '</div>' +
    '</div>',
  computed: {
    featureLabel: function () {
      if (!this.feature) {
        return 'none';
      }

      return this.feature.id + ' | ' + this.feature.properties.name;
    }
  },
  methods: {
    unselect: function () {
      console.log('select-info:unselect()');
      this.$emit('unselect');
    },
    zoom: function () {
      console.log('select-info:zoom()');
      this.$emit('zoom', this.feature);
    }
  }
};
