module.exports = {
  template: '<select :title="title" data-width="100%"><option v-for="opt in options" :value="opt[value]">{{opt[label]}}</option></select>',
  props: ['config', 'options', 'selected', 'label', 'value', 'title', 'multiple'],
  watch: {
    selected: function (selected) {
      $(this.$el).selectpicker('val', selected);
    }
  },
  mounted: function () {
    var vm = this;

    $(this.$el)
      .attr('multiple', this.multiple)
      .selectpicker(this.config)
      .on('loaded.bs.select', function (e) {
        $(this).selectpicker('val', vm.selected);
      })
      .on('change', function () {
        vm.$emit('input', $(this).selectpicker('val'));
      });
  },
  updated: function () {
    $(this.$el).selectpicker('refresh');
  },
  destroyed: function () {
    $(this.$el).off().selectpicker('destroy')
  }
};
