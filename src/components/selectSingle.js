module.exports = {
  template: '<select data-width="100%"><option v-for="opt in options" :value="opt[value]">{{opt[label]}}</option></select>',
  props: ['config', 'options', 'selected', 'label', 'value', 'title'],
  watch: {
    selected: function (value) {
      $(this.$el).selectpicker('val', value);
    }
  },
  mounted: function () {
    var vm = this;

    $(this.$el)
      .selectpicker(this.config)
      .selectpicker('val', vm.selected);

    $(this.$el).on('change', function () {
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
