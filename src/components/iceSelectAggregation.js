module.exports = {
  props: ['featureType', 'feature', 'show'],
  template: '<div class="ice-select-box aggregation text-right">' +
      '<div class="ice-select-box-title"><strong>Selected {{featureType}}:</strong> <span>{{featureLabel}}</span></div>' +
      '<div class="ice-select-box-body">' +
        '<button class="btn btn-default btn-xs pull-left" @click="data"><i class="fa fa-table"></i> Data</button>' +
        '<button class="btn btn-default btn-xs pull-left" @click="zoom"><i class="fa fa-search-plus"></i> Zoom To</button>' +
        '<button class="btn btn-default btn-xs pull-left" @click="catchments"><i class="fa fa-plus-circle"></i> Catchments</button>' +
        '<button class="btn btn-default btn-xs pull-left" @click="toggleShow"><span v-if="show"><i class="fa fa-eye-slash"></i> Hide</span><span v-else><i class="fa fa-eye"></i> Show</span> Unselected</button>' +
        '<button class="btn btn-default btn-xs pull-right" @click="unselect"><i class="fa fa-times-circle"></i> Unselect</button>' +
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
      this.$emit('unselect');
    },
    catchments: function () {
      this.$emit('catchments', this.feature);
    },
    zoom: function () {
      this.$emit('zoom', this.feature);
    },
    data: function () {
      this.$emit('data', this.feature);
    },
    toggleShow: function () {
      // console.log('select-aggregation: toggleShow', this.show);
      this.$emit('show', !this.show);
    }
  }
};
