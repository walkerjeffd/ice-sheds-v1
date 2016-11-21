module.exports = {
  props: ['config', 'options', 'selected', 'label', 'value', 'title'],
  template: '<select :title.once="title" multiple data-width="100%"><option v-for="opt in options" :value="opt[value]">{{opt[label]}}</option></select>',
  mounted: function () {
    var vm = this;
    $(this.$el)
      .selectpicker(this.config)
      .selectpicker('val', this.selected)
      .on('change', function () {
        vm.$emit('input', $(this).selectpicker('val'));
      });
  },
  watch: {
    selected: function (selected) {
      $(this.$el).selectpicker('val', selected);
    }
  },
  updated: function () {
    $(this.$el).selectpicker('refresh');
  },
  destroyed: function () {
    $(this.$el).off().selectpicker('destroy')
  }
};
