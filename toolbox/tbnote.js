(function() {
  var note = {
      text: 'This is a sample ToolBox notification.  Click on it to see how it is done.',
      link: 'https://github.com/agentlame/agentlame.github.io/edit/master/toolbox/tbnote.js',
      id: 1001
  };
  if (TBUtils) {
      TBUtils.showNote(note);
  }
})();
