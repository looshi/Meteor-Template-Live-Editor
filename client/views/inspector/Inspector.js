/*
Inspector

wraps an instance of CodeMirror
saves and retrieves Template code and CSS
renders a dynamic template
*/

// these should be scoped to this template instance
var cssEditor;
var htmlEditor;
var dataContext;
var userId;
var lastHtmlEditorId;
var lastCssEditorId;

Template.Inspector.created = function(){

  // this.cssError = new ReactiveVar("ok");
  // this.htmlError = new ReactiveVar("ok");

}

/**
* constructor-ish
* @param {Object} _dataContext, can be a Mongo Collection Cursor, or a regular object
* @param {Object} _parentElement , Dom object where the Template should be rendered
* @param {String} _templateId , the id of the Template Collection to edit
* @param {String} _userId , id of user is who is editing this template
*/
Template.Inspector.rendered = function(){

  dataContext = this.data;
  userId = Random.id();         // just fake it here for now
  lastHtmlEditorId = "notset";  // Last user that edited HTML 
  lastCssEditorId  = "notset"   // Last user that edited CSS

  cssEditor = new TextEditor('cmCss','css');
  cssEditor.on("change",saveCSS);

  htmlEditor = new TextEditor('cmHtml','html');
  htmlEditor.on("change",saveHTML);

  startObservers(this.dataContext,this);
}

Template.Inspector.helpers({

  htmlError : function(){
    return Template.instance().htmlError.get();
  },
  cssError : function(){
    return Template.instance().cssError.get();
  }

})


Template.Inspector.events({
  'click .restoreDefaults' : function(e){
    Meteor.call('restoreDefaults');
  }
});



var restoreDefaults = function (){
  Meteor.call('restoreDefaults');
}


var startObservers = function(_templateId,self){

  TemplateCollection.find({_id:_templateId}).observeChanges({
    added: function(id, doc) {
      htmlEditor.setValue(doc.html);
      renderHTML(doc.html,self);
      cssEditor.setValue(doc.css);
      renderCSS(doc.css);
    },
    changed: function(id,doc){
      onCssDataChanged(id,doc,self);
      onHtmlDataChanged(id,doc,self);
    }
  });
}

var onCssDataChanged = function(id,doc,self){

  if(doc.css){
    renderCSS(doc.css);
  }
  
  if(doc.lastModifiedBy){
    self.lastCssEditorId = doc.lastModifiedBy;
  }

  if(self.lastCssEditorId!==self.userId && doc.css){
    showAlert("css",self.lastCssEditorId);
    cssEditor.off("change",saveCSS);  // turn off auto save temporarily
    cssEditor.setValue(doc.css);
    cssEditor.on("change",saveCSS);
  }
}

var onHtmlDataChanged = function(id,doc,self){

  if(doc.html){
    renderHTML(doc.html,self); 
  }

  if(doc.lastModifiedBy){
    self.lastHtmlEditorId = doc.lastModifiedBy;  // only update my editor if someone else made the change
  }

  if(self.lastHtmlEditorId!==self.userId && doc.html){
    showAlert("html",self.lastHtmlEditorId);
    htmlEditor.off("change",saveHTML);  // turn off auto save temporarily
    htmlEditor.setValue(doc.html);
    htmlEditor.on("change",saveHTML);
  }
}


var saveCSS = function(_codeMirror){
  clearCssError();
  var newCSS = _codeMirror.getValue();
  if(newCSS && newCSS.length>800){
    displayCssError('Too long, must be less than 800 chars.','css'); 
    return;
  }
  if(newCSS){
    Meteor.call('saveCSS',newCSS,'NEED_TO_SCOPE_THIS');
  }
}


var renderCSS = function(_newCSS){

  var head = document.head || document.getElementsByTagName('head')[0];
  var style = document.createElement('style');

  style.type = 'text/css';
  if (style.styleSheet){
    style.styleSheet.cssText = _newCSS;
  } else {
    style.appendChild(document.createTextNode(_newCSS));
  }
  head.appendChild(style);
}

var saveHTML = function(_codeMirror){
  var newHTML = _codeMirror.getValue();
  Meteor.call('saveHTML',newHTML,'NEED_TO_SCOPE_THIS');
}

// renders html with a data context into the parent Dom object
// you can use spacebars {{ }} template tags in newHTML
var renderHTML = function(_newHTML,self){

  var dataContext = self.data.html;
  var parent = document.getElementById('htmlOutput');

  Template.instance().htmlError.set('ok');
  // going to 'try' it all, because we're auto-saving on each edit so
  // the malformed Blaze Template syntax will throw a lot of errors
  try{
    // create the 'HTMLjs' which is used internally by the template
    // https://meteorhacks.com/how-blaze-works.html
    var htmlJS = SpacebarsCompiler.compile(_newHTML);
    var evaled = eval(htmlJS);
    var view = Blaze.With(dataContext,evaled);

    // clear the output and re-render it
    _parent.innerHTML = "";
    Blaze.render(view,parent);
    
  }catch(e){ 
    Template.instance().htmlError.set(e);
  }
}





// displays a message if another user besides currentuser is editing this Template
var showAlert = function(file,user){
  var alert = document.getElementById('alertPanel');
  alert.style.display = "block";
  alert.innerHTML = "User " + user +" is editing the " + file + " now!"
  hideAlert();
}
var hideAlert = _.debounce(function(){
  document.getElementById('alertPanel').style.display = 'none';
},3000);



