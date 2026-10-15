const icons = require('./icons');
Component({
  properties: { name: { type: String, value: 'info' }, color: { type: String, value: 'ink' }, size: { type: Number, value: 36 } },
  data: { src: '' },
  observers: { 'name,color': function(name, color) { this.setData({ src: (icons[name] || icons.info)[color] || icons.info.ink }); } }
});
