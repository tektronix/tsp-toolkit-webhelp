var Kbase = {};

Kbase._layout = null;
Kbase._contentPanel = null;
Kbase._tocTree = null;
Kbase._tocToolbar = null;
Kbase._jsonToc = null;
Kbase._baseUrl = "";
Kbase._homeTopicId = -1;
Kbase._openingTopicId = -1;
Kbase._subTopicUrl = null;
Kbase._addingHistory = false;
Kbase._addHistory = true;
Kbase._indexPanel = null;
Kbase._indexData = null;
Kbase._indexPage = null;
Kbase._indexTabLoaded = false;
Kbase._indexPageFileLoaded = false;
Kbase._startSearchTime = null;
Kbase._jsonSearchStore = null;
Kbase._searchField = null;
Kbase._searchResultsPanel = null;
Kbase._isSearch = false;
Kbase._searchTerm = "";
Kbase._previousUrl = "";
Kbase._searchPartialWord = false;
Kbase._nodeUrl = "";
Kbase._googleAnalyticsAccId = null;
Kbase._locale = "en";
Kbase._requestedUrl = "";

//Google Analytics
Ext.Ajax.on('requestcomplete', function(connection, options, requestArge) { 

    if(Kbase._googleAnalyticsAccId){
        try{
            var pageTracker = _gat._getTracker(Kbase._googleAnalyticsAccId);
            var location = document.location.pathname;
            pageTracker._trackPageview(location.substring(0, location.lastIndexOf('/') + 1) + '#' + requestArge.url);
        }
        catch(err){ 
            err.description;
        }
    }
}); 

//@class AjaxDataStore
var AjaxDataStore = function(url){

    this.data = {};
    this.addEvents({
        "load" : true
    });
    
    if(url) {
        Ext.Ajax.request({
           url: url,
           success: function(response) {
                this.setData(response.responseText);
                this.fireEvent("load", this.data);
           },
           failure: function(response) {
                this.fireEvent("load", {});
           },
           scope: this
        });
    }
    this.setData = function(rawString){
        if( (url && url.indexOf(".json") != -1) || (!url)) 
        {
            //this.data = Ext.decode(rawString);
            var data = null;
            try {
                eval("data = " + rawString + ";");
            }
            catch(ex) {}
            
            this.data = data;
        }
        else this.data = rawString;
    }
}
Ext.extend(AjaxDataStore, Ext.util.Observable);

//@class FilteredTreeLoader
// Custom tree loader that enables us to filter the data before adding it to the tree
//
var FilteredTreeLoader = function(config, fnFilter){

    this.data = [];         //@prop: Full unfiltered data from the server.
    this.filter = fnFilter; //@prop: Function to filter the raw data.  This must create a _new_ data structure (so as not to modify this.data)
    
    FilteredTreeLoader.superclass.constructor.call(this, config);
};

Ext.extend(FilteredTreeLoader, Ext.tree.TreeLoader, {

    processResponse : function(response, node, callback){
        var json = response.responseText;
        try {
            json = json.replace(/\u2028/g,' ');//Firefox and Chrome fix (eval fail if the string contains the unicode character u2028)
            var o = eval("("+json+")");
            
            this.data = o;
            if(this.filter)
                o = this.filter(o);
            
            node.beginUpdate();
            for(var i = 0, len = o.length; i < len; i++){
                var n = this.createNode(o[i]);
                if(n){
                    node.appendChild(n);
                }
            }
            node.endUpdate();
            if(typeof callback == "function"){
                callback(this, node);
            }
        }catch(e){
            this.handleFailure(response);
        }
    },
	requestMethod: 'GET'
});


Kbase.GetLocalizedResource = function(name) {
    if(!resources || resources[name] == "") return name;
    return resources[name];
}

//----------- init function ------------ 
Kbase.init = function() {
    //Google Analytics 
    if(!Kbase._googleAnalyticsAccId) {
        var googleAnalyticsAccIdEl = document.getElementById('googleAnalyticsAccId');
        if(googleAnalyticsAccIdEl && googleAnalyticsAccIdEl.value)
            Kbase._googleAnalyticsAccId = googleAnalyticsAccIdEl.value;
    }
    
	//Set local if exist (if not exist 'en' English will be used as default) 
	var localeEle = document.getElementById('locale');
	if(localeEle || localeEle.value != "") Kbase._locale = localeEle.value;
	
    //load search.json
    this._jsonSearchStore = new AjaxDataStore('search.json'); 
    this._jsonSearchStore.on('load', this._searchFileLoaded, this);

    //load indexpage.htm
    Kbase._indexData = new AjaxDataStore('indexpage.htm');
    Kbase._indexData.on('load', 
    function(indexpage){
		// links to stylesheet files added in 'index.htm' file with order 'stylesheet.css' then 'webhelp.css' 
		// but in some browsers (e.g. Firefox and Opera) when 'indexpage.htm' is loaded and because it contains link to 'stylesheet.css' 
		// the browsers will apply it again after 'webhelp.css' this will change the priorety of the styles and causes the topic styles to change.
		// the solution is to remove the link to 'stylesheet.css'. (the problem accrue when index tab clicked)
		var re = new RegExp('<link .*?href="stylesheet.css".*?>', 'i');
		indexpage = indexpage.replace(re, '');
		Kbase._indexPage = indexpage;
        Kbase._indexPageFileLoaded = true; 
    }
    , this);

    // Set base url
    this._baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf("/")) + "/";
    
    Ext.BLANK_IMAGE_URL = 'extjs/resources/images/default/s.gif';
    
    Ext.QuickTips.init();
    
    Ext.History.init();
 
    this._contentPanel = {
        id: 'content-panel',
        region: 'center',
        layout: 'card',
        margins: '0 0 0 -2',
        activeItem: 0,
        title: '&nbsp;',
		header: true,
		border: true,
		autoScroll: false,
        items: [{
				border: false,
				header: false,
				autoScroll: true,
                contentEl: 'topic-content'
				}]	   
    };   

    var showCollapseAllIcon = Kbase._showIt("treeCollapsAll");
    var showExpandAllIcon = Kbase._showIt("treeExpandAll");
    
    this._tocToolbar = new Ext.Toolbar({
        id: 'toc-toolbar',
        cls: 'tree-node-toolbar-no-bg-image',
        border: false,
        items:[ '->', 
                {
                hidden: (!showCollapseAllIcon),
                iconCls: 'collapse', 
                handler : Kbase._onClick_collapse_icon,   
                scope: this, 
                tooltip: Kbase.GetLocalizedResource("Collapse All"),
                tooltipType: 'title'
               }, ' ',
               {
                hidden: (!showExpandAllIcon),
                iconCls: 'expand', 
                handler : Kbase._onClick_expand_icon, 
                scope: this, 
                tooltip: Kbase.GetLocalizedResource("Expand All"), 
                tooltipType: 'title'
               }
            ]
    });
    
    var treeLoader = new Ext.tree.TreeLoader();
    // TOC Tree panel   
    this._tocTreeConfig = {
        id: 'tree-panel',
        title: Kbase.GetLocalizedResource("Contents"),
        header: false,
        minSize: 150,
        border: false,
        margins: '0 0 0 0',
        rootVisible: false,
        lines: true,
        singleExpand: false,
        useArrows: true,
        containerScroll: true,
        animate: false,
        autoScroll: true,
        tbar: ((showCollapseAllIcon || showExpandAllIcon) ? this._tocToolbar : ''), //adds the CollapseAll/ExpandAll buttons    
        loader: new FilteredTreeLoader({ dataUrl:'toc.json' }, Kbase._filterData)
    };
    this._tocTree = new Ext.tree.TreePanel(this._tocTreeConfig);

    var root = new Ext.tree.AsyncTreeNode();
    this._tocTree.setRootNode(root);

    // index Panel
    this._indexPanel = new Ext.Panel({
        id: 'index-panel',
        title: Kbase.GetLocalizedResource("Index"),
        header: false,
        border: false,
        layout: 'fit',
        autoScroll: true,
        html: '<table align="center"><tr><td class="loading">' + Kbase.GetLocalizedResource("Loading") + '</td></tr></table>'
	});

    this._indexPanel.on('render', Kbase._onRender_indexTab, this);

    // To show/hide icons
    // Home icon 
    var showHomeIcon = Kbase._showIt("homeIcon");
    // Tree Navigation Arrows 
    var showTreeNavigationArrows = Kbase._showIt("treeNavigationArrows");
    // Email This Page icon
    var showEmailIcon = Kbase._showIt("emailIcon");
    // Feedback icon 
    var showFeedbackIcon = Kbase._showIt("sendFeedbackIcon");
    // Print icon
    var showPrintIcon = Kbase._showIt("printIcon");
    // Edit This Topic icon
    var showEditIcon = Kbase._showIt("editIcon");
    // Edit Live icon (hidden by default)
    var showEditLiveIcon = false;
    
    // Show/Hide header
    var showHeader = Kbase._showIt("showHeader");
    
    // Start with collapsed West panel
    var collapsedWestPanel = Kbase._showIt("collapsedWestPanel");
    
    //Set search results to match partial words by default 
    //Note: this setting will apply regardless whether the 'Match partial words' showing or not 
    var matchPartialWordsInResult = Kbase._showIt("matchPartialWordsInResult");
    var checked;
    if(matchPartialWordsInResult){
        checked = "checked";
    }else{
        checked = "";
    }
    
    // Show Match partial words with Search
    var MatchPartialWords = Kbase._showIt("matchPartialWords");
    
    var MatchPartialWordsForm;
    var style = "";
    
    if(!MatchPartialWords)//hide Match Partial Words option
        style = 'style="display: none;"';

    MatchPartialWordsForm = '<form id="checkBoxForm" ' + style + '><input type="checkbox" ' + checked + ' name="matchPartialWord" onClick="Kbase._setSearchPartialWord()"><span class="checkbox-text">' + Kbase.GetLocalizedResource("Match partial words") + '</span></form>';
    
    // West Panel Width
    var WestPanelWidth = 250;
    var WestPanelWidthElement = document.getElementById("westPanelWidth");
    if(WestPanelWidthElement){
        var wpw = parseInt(WestPanelWidthElement.value);
        if(!isNaN(wpw))
            WestPanelWidth = wpw;
    } 
    
    // West panel maximum width limit
    var WestPanelMaxWidth = 400;
    var WestPanelMaxWidthElement = document.getElementById("westPanelMaxWidth");
    if(WestPanelMaxWidthElement){
        var wpmaxw = parseInt(WestPanelMaxWidthElement.value);
        if(!isNaN(wpmaxw))
            WestPanelMaxWidth = wpmaxw;
    } 
    
    // West panel minimum width limit
    var WestPanelMinWidth = 190;
    var WestPanelMinWidthElement = document.getElementById("westPanelMinWidth");
    if(WestPanelMinWidthElement){
        var wpminw = parseInt(WestPanelMinWidthElement.value);
        if(!isNaN(wpminw))
            WestPanelMinWidth = wpminw;
    } 
    
    // Enable show/hide option for 'Edit Live icon' only if IE6 and over
    if(Ext.isIE){
        //getting IE version from userAgent (Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0; SLCC1 .....)
        var userAgent = navigator.userAgent;
        var ieIndex = userAgent.indexOf("MSIE");
        var ieVersion = userAgent.substr(userAgent.indexOf("MSIE") + 5, 1);
        showEditLiveIcon = Kbase._showIt("EditLiveIcon") && (parseInt(ieVersion) >= 6);
    }
    
    var headerHeight = 50;
    var ToolbarHeight = 25;//25 is the height for Toolbar below header (the mainToolbar)
    //check whether the header is hidden or not
    if(!showHeader){//Hide Header
        headerHeight = 0;
    }else {
        //set the header height dynamically from whatever set in css i.e. (div#header { height: 80px; ...... } 
        if(document.getElementById("header")){
            var headerH = Util.getStyle(document.getElementById("header"), "height");
            if(headerH){
                var hh = parseInt(headerH);
                if(!isNaN(hh))
                    headerHeight = hh;
            }
        }
    }
   
    //search field to add to toolbar 
    this._searchField = new Ext.form.TextField({id: 'search-textfield', width: 200, emptyText: Kbase.GetLocalizedResource("Search")})
    this._searchField.on('specialkey', this._searchField_specialkey, this);
    this._searchField.setValue(Kbase.GetLocalizedResource("Search loading"));
   
    // build the main layout
    this._layout = new Ext.Viewport({
        layout: 'border',
        margins: '0 0 0 0',
        items: [ this._contentPanel,
            new Ext.Panel({//Header and Toolbar
                id: 'north-panel',
                border: false,
                region: 'north',
                height: (headerHeight + ToolbarHeight),
                items: [
                    {//Header
                        el:'header',
                        border:false,
                        xtype: 'box',
                        hidden: (!showHeader),
                        height: headerHeight
                    },
                    new Ext.Toolbar({//Toolbar
                        id: 'mainToolbar',
                        cls: 'x-small-editor-no-bg-image',
                        items: [ ' ', ' ',
                            {
                                hidden: (!showHomeIcon),
                                iconCls: 'homeIcon',
			                    tooltip: Kbase.GetLocalizedResource("Home"),
			                    tooltipType: 'title',
			                    scope: this,
			                    handler: this._onClick_home_icon
                            }
                            ,' ',' ',
                             {
                                hidden: (!showTreeNavigationArrows),
                                iconCls: 'upIcon',
			                    tooltip: Kbase.GetLocalizedResource("Previous"),
			                    tooltipType: 'title',
			                    scope: this,
			                    handler: this._tocTree_selectPrevious
                            }
                            ,' ',' ',
                             {
                                hidden: (!showTreeNavigationArrows),
                                iconCls: 'downIcon',
			                    tooltip: Kbase.GetLocalizedResource("Next"),
			                    tooltipType: 'title', 
			                    scope: this,
			                    handler: this._tocTree_selectNext
                            }
                            ,'->',
                            {
                                hidden: (!showEditIcon),
                                iconCls: 'EditIcon',
			                    tooltip: Kbase.GetLocalizedResource("Edit in Author-it"),
			                    tooltipType: 'title',
			                    handler: this._onClick_edit_icon
                            }
                            ,' ',' ',
                            {
                                hidden: (!showEditLiveIcon),
                                iconCls: 'EditLiveIcon',
			                    tooltip: Kbase.GetLocalizedResource("Edit in Author-it Live"),
			                    tooltipType: 'title',
			                    handler: this._onClick_edit_live_icon
                            }
                            ,' ',' ',
                            { 
                                hidden: (!showEmailIcon),
                                iconCls: 'emailThisPageIcon',
			                    tooltip: Kbase.GetLocalizedResource("Email this page"),
			                    tooltipType: 'title',
			                    handler: this._onClick_email_icon
                            }
                            ,' ',' ',
                            {
                                hidden: (!showFeedbackIcon),
                                iconCls: 'sendFeedbackIcon',
			                    tooltip: Kbase.GetLocalizedResource("Send feedback"),
			                    tooltipType: 'title',
			                    handler: this._onClick_feedback_icon
                            }
                            ,' ',' ',
                             {
                                hidden: (!showPrintIcon),
                                iconCls: 'printIcon',
			                    tooltip: Kbase.GetLocalizedResource("Print this page"),
			                    tooltipType: 'title', 
			                    scope: this,
			                    handler: this._onClick_print_icon
                            }
                            ,' ',' ',' ',' ',
                            //search
                            this._searchField
		                    , ' ', ' ',
		                    {
		                        id: 'search-Icon',
                                iconCls: 'searchIcon',
			                    tooltip: Kbase.GetLocalizedResource("Search"),
                                tooltipType: 'title',
                                handler: this._search
                            }
                            , ' ', ' ',
                            
                            MatchPartialWordsForm
                             
                            ,' ', ' ',' '
                           
                        ]
                    })
                ]
            })
        , {
            id: 'westPanelID',
            region: (Kbase._locale == 'ar' || Kbase._locale == 'fa' || Kbase._locale == 'he') ? 'east' : 'west',
            collapsible: true,
            collapsed: collapsedWestPanel,
            title: '',
            header: true,
            split: true,
            width: WestPanelWidth,
            minSize: WestPanelMinWidth,
            maxSize: WestPanelMaxWidth,
            layout: 'fit',
            margins: '0 0 0 0',
            border: true,
            titlebar: true,
            animate: true,
            items: [
                { xtype: 'tabpanel',
                id: 'tab-panel',
                border: false,
                activeTab: 1,
                margins: '0 0 0 0',
                tabPosition: 'bottom',
                items: [this._tocTree, this._indexPanel] }
            ]
        }
		],
        renderTo: Ext.getBody()
    });

    // To Add Attribute 'title' (to view on mouse hover) to the West panel expand collapse bar 
    Kbase._addToolTip();
    Ext.getCmp('westPanelID').on('collapse', Kbase._addToolTip, this);
    
    Ext.getCmp('search-Icon').disable();
    this._searchField.disable();

    this._tocTree.getLoader().on('load', this._onLoad_tocTreeLoaded, this);

    //'selection change' event for the Tree panel (this._tocTree) to load the content of the Node selected 
    this._tocTree.getSelectionModel().on('selectionchange', this._onSelectionchange_tocTree, this);
  
    Ext.getCmp('tab-panel').on('tabchange', this._onTabchange_tabPanel, this);
    
    // When history changed load related topic (if its not in add history mode)
    Ext.History.on('change', function(token){
        if(Kbase._addingHistory){ 
            Kbase._addingHistory = false;
        }else if(token){
            Kbase._addHistory = false;
            if(token == "#") token = "";
            Kbase._addingHistory = false;
            Kbase._F_openTopicByUrl(token);
        } else { 
            Kbase._addHistory = false;
            if(Ext.isGecko) Kbase._F_openTopicById(Kbase._homeTopicId); 
        }
    });
    
    //set the value of Kbase._searchPartialWord depends on if the checkbox 'matchPartialWord' is checked or not
    var checkBoxForm = document.forms['checkBoxForm'];
    if( checkBoxForm && checkBoxForm.matchPartialWord )
        Kbase._searchPartialWord = checkBoxForm.matchPartialWord.checked;

    this._init_changeActiveTab.defer(1);
};
//----------- End of init function ------------  
 
 
    //check the value return false if so
Kbase._showIt = function(configHfId){
        var IconHf = document.getElementById(configHfId);
        if(!IconHf) return true;
        if(IconHf.value.toLowerCase().indexOf("false") != -1) return false;
        
        return true;
};
 
 
Kbase._init_changeActiveTab = function(){
    Ext.getCmp('tab-panel').setActiveTab('tree-panel');
    //'onmouseover' event for the tree panel to re wright tree nodes links to support the 'Open in New Tab' and 'Open in New Window' browser functions 
    if(Ext.getCmp('tree-panel').body){
        Ext.getCmp('tree-panel').body.on('mouseover', Kbase._onMouseover_treePanel); 
    }
};

//----------------- Events Handlers --------------------

Kbase._addToolTip = function(){
    // Add Attribute 'title' (to view on mouse hover) to the West panel expand collapse bar 
    var westPanelIDxcollapsed = document.getElementById("westPanelID-xcollapsed");
    if(westPanelIDxcollapsed){
        westPanelIDxcollapsed.setAttribute("title", Kbase.GetLocalizedResource("Click to Expand/Collapse"));
        // Add Attribute 'title' (to view on mouse hover) to the West panel expand collapse bar button
        if(westPanelIDxcollapsed.firstChild) westPanelIDxcollapsed.firstChild.setAttribute("title", Kbase.GetLocalizedResource("Click to Expand (Auto hide off)"));
    }
}

Kbase._setSearchPartialWord = function(){
    var checkBoxForm = document.forms['checkBoxForm'];
    if( checkBoxForm && checkBoxForm.matchPartialWord ){
        Kbase._searchPartialWord = checkBoxForm.matchPartialWord.checked;
    }
}

// West TabPanel Tab Change 
Kbase._onTabchange_tabPanel = function(){
    var tabPanelCmp = Ext.getCmp('tab-panel');
    // Set West Panel Title (change the title when tab clicked)
    Ext.getCmp('westPanelID').setTitle(tabPanelCmp.getActiveTab().title);
    if(tabPanelCmp.getActiveTab().id == "index-panel" && !Kbase._indexTabLoaded){
        Kbase._updateIndexTab.defer(1);
    }

    if(tabPanelCmp.getActiveTab().id == "tree-panel"){
        var sm = Kbase._tocTree.getSelectionModel();
        var selNode = sm.getSelectedNode();
        if(selNode != null){
            Util.scrollToTop(Ext.get(selNode.getUI().textNode), Kbase._tocTree.getEl().dom.childNodes[0].childNodes[0]);
        }
    }
    if(tabPanelCmp.getActiveTab().id != "extSearchResultsPanel") Kbase._isSearch = false;
    
};

Kbase._filterData = function(input) {  
    var output = [];
    Kbase._recurseFilterData(input, output);
    return output;
}

Kbase._recurseFilterData = function(input, output) {
        
    for(var i = 0, ci = input.length; i < ci; i++) {
        
        var inputData = input[i];
        if(inputData.hidden) continue;
        
        var outputData = {
            id:     inputData.id,
            text:   inputData.text,
            leaf:   inputData.leaf,
            node:   inputData.node,
            href:   inputData.url,
            url:    inputData.url,
            children: []
        };
        
        if(inputData.children)
            Kbase._recurseFilterData(inputData.children, outputData.children);
                
        output.push(outputData);
    }
}

// When tree loaded
Kbase._onLoad_tocTreeLoaded = function() {
    // Assign toc.json data to Kbase._jsonToc (not filtered -with all nodes including hidden nodes)
    Kbase._jsonToc = this._tocTree.getLoader().data;

    //set _homeTopicId to start with (as default)
    var firstNode = Kbase._tocTree.getRootNode().firstChild;
    Kbase._homeTopicId = firstNode.id;

    var url = document.location.href;
    
    Kbase._F_openTopicByUrl(url);
};

// Calls appropriate open topic function.  Wired to onclicks.
Kbase._H_openTopicHandler = function(e, source, url) {
    if(e) e.preventDefault();
    Kbase._F_openTopicByUrl(url);
};

// open topic function
Kbase._F_openTopicByUrl = function(url) {
	Kbase._requestedUrl = url;
    Kbase._openingTopicId = Kbase._homeTopicId;
    
    // Get topic id from url (if any)
    var topicFileName = url.replace(Kbase._baseUrl, "");
    
    if(topicFileName != "" && topicFileName != "index.htm"){
        topicFileName = topicFileName.replace("index.htm", "");
        //remove first hash (if url Kbase._baseUrl/index.htm#...  or Kbase._baseUrl/#...)
        topicFileName = topicFileName.replace("#", "");
        
		//what left from url e.g. either 1234.htm or 1234.htm#o2345 or 1234.htm#sectionName 
		//save hash value if any
		var subTopicHashIndex = topicFileName.indexOf("#o");
		var sectionHashIndex = topicFileName.indexOf("#");
		if(subTopicHashIndex > 0) {//url has link to sub topic
			Kbase._subTopicUrl = topicFileName.substring(subTopicHashIndex);
			topicFileName = topicFileName.substring(0, subTopicHashIndex);
		}
		else if (sectionHashIndex > 0){//url has link to section
			Kbase._subTopicUrl = topicFileName.substring(sectionHashIndex);
			topicFileName = topicFileName.substring(0, sectionHashIndex);
		}
		else Kbase._subTopicUrl = null;
        Kbase._setOpenTopic(topicFileName, false);
    }else{
        // There is no topic in url so get home page (to open it) from config section in index.htm 
        var homeTopicEl = document.getElementById('homeTopic');
        if(homeTopicEl && homeTopicEl.value != "" ){
            topicFileName = homeTopicEl.value;
            Kbase._setOpenTopic(topicFileName, true);
        }
    }  
    Kbase._F_openTopicById(Kbase._openingTopicId);
};

Kbase._setOpenTopic = function(topicFileName, isHome){
    // To be used in Kbase._openTopic when topic not included in toc
    Kbase._nodeUrl = topicFileName;

    var nodeData = Kbase._F_getDataNodeByParameter(Kbase._jsonToc, "url", topicFileName);
    
    if(!nodeData) { //node not found
        Kbase._openingTopicId = Kbase._homeTopicId; 
        return;
    }
    
    // To view node included in TOC all parent nodes needs to be expanded (important) 
    var treeNode = Kbase._tocTree.getRootNode();
    if(treeNode){
        var path = nodeData.node.split("+");
        for (var i = 0, ci = path.length; i < ci; i++)
        {
            if(treeNode.childNodes.length > 0 ){//&& !treeNode.attributes.hidden
                treeNode = treeNode.childNodes[path[i]];
                if(!treeNode)//not exist i.e. the main parent node is hidden and all its children 
                    break;
                else if(!treeNode.leaf && i != ci-1)
                    treeNode.expand();  
            }
        }
    }
    var nodeId = nodeData.id
    Kbase._openingTopicId = nodeId;
    if(isHome) Kbase._homeTopicId = nodeId;
};

Kbase._F_getDataNodeByParameter = function(dataStore, parameterName, parameterValue){

    if(dataStore && dataStore.length){
        for(var i = 0, ci = dataStore.length; i < ci; i++) {
            if(dataStore[i][parameterName] == parameterValue)
                return dataStore[i];

            var dataStoreChildren = dataStore[i].children;
            if(dataStoreChildren){
                var nodeFound = Kbase._F_getDataNodeByParameter(dataStoreChildren, parameterName, parameterValue);
                if(nodeFound) return nodeFound;
            }
        }
    }  
};

// Open topic by topic id
Kbase._F_openTopicById = function(topicId) {
    var topicNode = Kbase._tocTree.getNodeById(topicId);

    if(topicNode) {
        topicNode.ensureVisible();
        if(topicNode.isSelected()) topicNode.unselect();
        Kbase._tocTree.getSelectionModel().select(topicNode);
        Kbase._highlightTextNodeEffect(Ext.get(topicNode.getUI().textNode));//heighlight the node text
    }else{
        // The topic/node is not included in the tree (hidden)
        Kbase._openTopic(topicId, Kbase._nodeUrl);
    }
};


 //------------ re write tree nods href on mouseover -----------------
 Kbase._onMouseover_treePanel = function(e, t) {
    var nodeEl = Ext.fly(t);
    if(nodeEl){
        var nodeId = nodeEl.getAttributeNS('ext', 'tree-node-id');
        if(!nodeId){
            nodeEl = nodeEl.up('div.x-tree-node-el');
            if(nodeEl)
                nodeId = nodeEl.getAttributeNS('ext', 'tree-node-id');
        }
    }  
    if(nodeId){
        var aTags = nodeEl.dom.getElementsByTagName('A');
        if(aTags.length > 0){
            if(aTags[0].href != ""){
                var contentUrl = Kbase._tocTree.nodeHash[nodeId].attributes.url;
                aTags[0].href = Kbase._baseUrl + "index.htm#" + contentUrl;
            }                     
        }
    } 
 };
//-----------------------------------

// Back to Home Icon   
Kbase._onClick_home_icon = function() {
    if(Kbase._tocTree.getNodeById(Kbase._homeTopicId)){
        Kbase._tocTree.getNodeById(Kbase._homeTopicId).select();
        Kbase._tocTree.collapseAll();
    }
};

// Select previous (up)
Kbase._tocTree_selectPrevious = function() {
    Ext.getCmp('tab-panel').setActiveTab('tree-panel');
    var sm = Kbase._tocTree.getSelectionModel();
    sm.selectPrevious();
    
    var selNode = sm.getSelectedNode();
    if(selNode != null){
        Util.scrollToTop(Ext.get(selNode.getUI().textNode), Kbase._tocTree.getEl().dom.childNodes[0].childNodes[0]);
        if(!selNode.isExpanded())
            Kbase._tocTree_selectNext_expandNode.defer(1, this, [selNode]);
    }
};

// Select next (down)
Kbase._tocTree_selectNext = function() {
    Ext.getCmp('tab-panel').setActiveTab('tree-panel');
    var sm = Kbase._tocTree.getSelectionModel();
    sm.selectNext();
    
    var selNode = sm.getSelectedNode();
    if(selNode != null){
        Util.scrollToTop(Ext.get(selNode.getUI().textNode), Kbase._tocTree.getEl().dom.childNodes[0].childNodes[0]);
        if(!selNode.isExpanded())
            Kbase._tocTree_selectNext_expandNode.defer(1, this, [selNode]);
    }
};

Kbase._tocTree_selectNext_expandNode = function(selNode){ 
    selNode.expand(); 
    Kbase._highlightTextNodeEffect(Ext.get(selNode.getUI().textNode));//heighlight the node text
};

// Edit this Topic
Kbase._onClick_edit_icon = function() {
    var editCommandEl = document.getElementById('sys_library_command_line');
    var editCommand = "";
    if(editCommandEl)
        editCommand = editCommandEl.value;

    var bookIdEl = document.getElementById('bookId');
    var bookId = "";
    if(bookIdEl)
        bookId = bookIdEl.value;

    var topicIdEl = document.getElementById('topicId');
    var topicId = "";
    if(topicIdEl)
        topicId = topicIdEl.value;
        
    window.open("authorit: " + editCommand + " /bookid" + bookId + " /objectid" + topicId);
};

// Edit in Author-it Live
Kbase._onClick_edit_live_icon = function() {
    var editEl = document.getElementById('liveServer');
    var topicIdEl = document.getElementById('topicId');
    var aliasEl = document.getElementById('liveServerAlias');
    
    if(editEl && topicIdEl && aliasEl){
        var live_server = editEl.value;
        var topicId = topicIdEl.value;
        var alias = aliasEl.value;

        window.open(live_server + "/?alias=" + alias + "&opentopic=" + topicId);
    } 
};

// Email this page
Kbase._onClick_email_icon = function() {
    var siteNameEl = document.getElementById('siteName');
    var siteName = "";
    if(siteNameEl)
        siteName = escape(siteNameEl.value);
    
    var sm = Kbase._tocTree.getSelectionModel();
    var articleName = "";
    if(sm.getSelectedNode())
        articleName = escape("(" +sm.getSelectedNode().text + ")");
        
    var topicIdEl = document.getElementById('topicId');
    var topicId = "";
    if(topicIdEl)
        topicId = escape(" " + topicIdEl.value  );

    var pageUrl = escape(document.location.href);
    
    document.location.href=("mailto:?Subject=(" + Kbase.GetLocalizedResource("Link")+ ") " + siteName + " : " + topicId + " " + articleName + "&Body=" +  pageUrl) ;  
};

// Send Feedback
Kbase._onClick_feedback_icon = function() {
    var feedbackEmailEl = document.getElementById('feedbackEmail');
    var feedbackEmail = "";
    if(feedbackEmailEl)
        feedbackEmail = escape(feedbackEmailEl.value);//URL encode 
    
    var topicIdEl = document.getElementById('topicId');
    var topicId = "";
    if(topicIdEl)
        topicId = escape(topicIdEl.value);

    var sm = Kbase._tocTree.getSelectionModel();
    var articleName = "";
    if(sm.getSelectedNode())
        articleName = escape(" (" + sm.getSelectedNode().text + ")");
        
    var siteNameEl = document.getElementById('siteName');
    var siteName = "";
    if(siteNameEl)
        siteName = escape(siteNameEl.value);
        
    var pageUrl = escape(document.location.href);

    var feedBackTextEl = document.getElementById('feedBackText');
    var feedBackText = "";
    if(feedBackTextEl)
        feedBackText = feedBackTextEl.value;

    document.location.href= "mailto:" + feedbackEmail +"?Subject=(" + Kbase.GetLocalizedResource("Feedback")+ ") " + siteName + " : " + topicId + articleName + "&Body=" + feedBackText + "%20%0D%0A%0D%0AURL%20" + pageUrl;
};

// Print Icon
Kbase._onClick_print_icon = function() {
     
    var DocumentContainer = document.getElementById('topic-content');
    var WindowObject = window.open('','', 'toolbar=yes,status=yes,width=800,height=600,scrollbars=yes,resizable=yes,menubar=yes');

    var linkElements = document.getElementsByTagName("link");                 
    
    var links = "";
    for(var i = 0; i < linkElements.length; i++ ){
        if(Ext.isIE) links += linkElements[i].outerHTML;
        else {
            var linkTag = "<link ";
            for(var j = 0; j < linkElements[i].attributes.length; j++ ){
                linkTag += linkElements[i].attributes[j].nodeName + "='" + linkElements[i].attributes[j].nodeValue + "' ";
            }
            linkTag += "></link>";
            links += linkTag;
        }
    }
                              
    WindowObject.document.writeln("<html><body style='overflow: scroll'>"+ links + DocumentContainer.parentNode.innerHTML + "</body></html>");
    WindowObject.document.close();
    WindowObject.focus();
    Kbase_print.defer(100, this, [WindowObject]);
};

Kbase_print = function(WindowObject){
    WindowObject.print();
    //WindowObject.close();
}

// Toc Tree CollapseAll 
Kbase._onClick_collapse_icon = function() {
    Kbase._tocTree.collapseAll();
};

// Toc Tree Expand All 
Kbase._onClick_expand_icon = function() {
    Kbase._tocTree.expandAll();
};

// Special key pressed inside search field
Kbase._searchField_specialkey = function(field, e) {
    if(e.getKey() == e.ENTER)
        Kbase._search();
};

Kbase._onRender_indexTab = function(){
    Kbase._indexPanel.rendered = true;
};

Kbase._updateIndexTab = function(){
    // --- Load index --- To load index content 
    if(Kbase._indexPageFileLoaded && Kbase._indexPanel.rendered && !Kbase._indexTabLoaded){
        Kbase._doUpdateIndexTab.defer(1);
    }
    else Kbase._updateIndexTab.defer(1);
};

Kbase._doUpdateIndexTab = function(){
    Kbase._indexPanel.body.dom.id = 'index';
    var indexDivID = Kbase._indexPanel.body.dom.id;
    Ext.get(indexDivID).update(Kbase._indexPage);
    // Remove index heading
    var headingElems = Ext.DomQuery.select('#'+ indexDivID +' h1');
    if(headingElems[0]) Ext.get(headingElems[0]).remove();
       
    // Remove any images
    var imageElems = Ext.DomQuery.select('#'+ indexDivID +' img');
    for (var i = imageElems.length - 1; i >= 0; i--) {
        Ext.get(imageElems[i]).remove();
    }

    // ----------------- Rewrite index letters links ---------------------
    var letterElems = Ext.DomQuery.select('#'+ indexDivID +' p.indexatoz a');

    for (var k = 0, ck = letterElems.length; k < ck; k++) {
        var letterElem = letterElems[k];
        var letterId = letterElem.href.substring(letterElem.href.lastIndexOf('#') + 1);
        letterElem.href = '#';
        Ext.get(letterElem).on('click', Kbase._navigateToIndexLetter, this, letterId);

        // If not ie browser, rewrite name element on letters to id
        if (!Ext.isIE) {
            var linkTarget = document.getElementsByName(letterId);
            if (linkTarget.length == 1)
                linkTarget[0].id = linkTarget[0].name;
        }
    } 
    //'onmouseover' event for the index panel to re wright links to topics
    if(Ext.getCmp('index-panel').body){
        Ext.getCmp('index-panel').body.on('mouseover', Kbase._onMouseover_indexPanel); 
        Ext.getCmp('index-panel').body.on('click', Kbase._onClick_indexPanel); 
    }

    Kbase._indexTabLoaded = true;
};

 Kbase._onMouseover_indexPanel = function(e, t) {
    var link = Ext.fly(t).up('td.indexlink');
    if(link){
        var contentUrl = "";
        var linkEl = null;
        if(link.dom.childNodes[0].tagName){
            if(link.dom.childNodes[0].tagName.toLowerCase() == "a"){
                contentUrl = link.dom.childNodes[0].href;
                linkEl = link.dom.childNodes[0];
                
            }
        }else if(link.dom.childNodes[0].nextSibling.tagName){
            if(link.dom.childNodes[0].nextSibling.tagName.toLowerCase() == "a"){
                contentUrl = link.dom.childNodes[0].nextSibling.href;
                linkEl = link.dom.childNodes[0].nextSibling;
            }
        }
        
        if(contentUrl != ""){
            contentUrl = contentUrl.substring(contentUrl.lastIndexOf("/") + 1);
            if(contentUrl.indexOf("index.htm#") == -1){
                var topicUrl = Kbase._baseUrl + "index.htm#" + contentUrl;
                linkEl.href = topicUrl;
                Ext.get(linkEl).on('click', Kbase._H_openTopicHandler, this, topicUrl);
            }
        }
    }
 };

Kbase._onClick_indexPanel = function(e, t){

    var link = Ext.fly(t).up('td.indexlink');
    if(link){
        var contentUrl = "";
        var linkEl = null;
        if(link.dom.childNodes[0].tagName){
            if(link.dom.childNodes[0].tagName.toLowerCase() == "a"){
                contentUrl = link.dom.childNodes[0].href;
            }
        }else if(link.dom.childNodes[0].nextSibling.tagName){
            if(link.dom.childNodes[0].nextSibling.tagName.toLowerCase() == "a"){
                contentUrl = link.dom.childNodes[0].nextSibling.href;
            }
        }
    }
};


// Scroll index to a letter
Kbase._navigateToIndexLetter = function(e, source, letterId) {
    e.preventDefault();
    var letterElem = Ext.get(letterId);
    if(letterElem) {
        Util.scrollToTop(letterElem, Kbase._indexPanel.body.dom.id);
    }
};

// TOC Tree clicked or using .select() function will trigger 'selectionchange' event for Kbase._tocTree which calls Kbase function '_onSelectionchange_tocTree'  
Kbase._onSelectionchange_tocTree = function(selectionModel, node) { 
    if(node && !node.isRoot) {
        Kbase._openTopic(node.id, node.attributes.url);
    }
}; 


String.prototype.count = function(char){   
	return this.split(char).length-1;   
};

Kbase._openTopic = function (id, topicUrl){

    Kbase._openingTopicId = id;
    var url = topicUrl; 
    //add to history
    if(Kbase._addHistory && url != null){
        Kbase._addingHistory = true;
        Ext.History.add(url);
    }
    
    Kbase._addHistory = true;
    
    Ext.Ajax.on('requestexception', Kbase._showError);
    
    //striping subtopic of contentUrl and store it in Kbase._subTopicUrl (Author-it uses '#o' in topic url to indicate a subtopic)
    var subtopicIndex = topicUrl.indexOf("#o");
	var hashCount = topicUrl.count('#');
    if(subtopicIndex > 0){
       Kbase._subTopicUrl = topicUrl.substring(subtopicIndex);
       topicUrl = topicUrl.substring(0, subtopicIndex);
    } 
	else if (hashCount == 2){//check if there is a link to a section in the topic
         
		 var lastHashIndex = topicUrl.lastIndexOf("#");
		 if(lastHashIndex > 0){
			var sectionName = topicUrl.substring(lastHashIndex);
			if(sectionName.length > 0){
				Kbase._subTopicUrl = sectionName;
				topicUrl = topicUrl.substring(0, lastHashIndex);
			}
		 }
    }
	else if(Kbase._subTopicUrl != null && Kbase._requestedUrl.indexOf(Kbase._subTopicUrl) == -1) {

        Kbase._subTopicUrl = null; 
		Kbase._requestedUrl = "";
    }

    // Request content
    Ext.Ajax.request({
        url: topicUrl,
        success: Kbase._content_response,
        failure: Kbase._showError(this),
        scope: this
    });

};

Kbase._showError = function(response){
    Ext.get('start-panel').update(response.responseText, true);
};

// Content received load it into start-panel in content panel
Kbase._content_response = function(response) {
    Ext.get('start-panel').update(response.responseText, true);
    
    //------------------ build breadcrumb links ----------------------    
    // Build & set content panel title as breadcrumb trail to topic title
    var title = "&nbsp;";
    var currentNode = Kbase._tocTree.getNodeById(Kbase._openingTopicId);
    if(currentNode){
        title = currentNode.text;
        
        title = "<span class=\"breadcrumb\" >" + title + "&nbsp;</span>";
        
        while(currentNode.getDepth() > 1) {
            currentNode = currentNode.parentNode;
            var contentUrl = currentNode.attributes.url;
			if (Kbase._locale == 'ar' || Kbase._locale == 'fa' || Kbase._locale == 'he'){
				title = title + "&nbsp;&lt;&nbsp;" + "<a class=\"breadcrumb\" href=\"" + Kbase._baseUrl + "index.htm#" + contentUrl +  "\" topicId=\"" + currentNode.id  + "\">" + currentNode.text + "</a>";
			}
			else {
				title = "<a class=\"breadcrumb\" href=\"" + Kbase._baseUrl + "index.htm#" + contentUrl +  "\" topicId=\"" + currentNode.id  + "\">" + currentNode.text + "</a>&nbsp;&gt;&nbsp;" + title;
			}
		}
    }else {// node is not included in toc 
        // Check if hidden node in TOC set to show in breadcrumb
        var showInBreadcrumb = Kbase._showIt('hiddenTocTopics');
        if(showInBreadcrumb){
            var title;
            // Get node from Kbase._jsonToc
            var jsonTocDataNode = Kbase._F_getDataNodeByParameter(Kbase._jsonToc, "id", Kbase._openingTopicId);   
            if(jsonTocDataNode) {
                title = jsonTocDataNode.text;
                title = "<span class=\"breadcrumb\" >" + title + "&nbsp;</span>";
                
                var nodePath = jsonTocDataNode.node;
                var path = nodePath.split("+");
                var breadcrumb = "";
                var currentPath;
                for (var i = 0, ci = path.length; i < ci; i++)
                {
                   if(i == ci - 1) continue;// We are after the parent nodes 
                    currentPath = i == 0 ? path[i] : currentPath + "+" + path[i];
                    var dataNode = Kbase._F_getDataNodeByParameter(Kbase._jsonToc, "node", currentPath);  
                    if(dataNode) {
                        var url = dataNode.url;    
						if (Kbase._locale == 'ar' || Kbase._locale == 'fa' || Kbase._locale == 'he') {
							breadcrumb += "&nbsp;&lt;&nbsp;" + "<a class=\"breadcrumb\" href=\"" + Kbase._baseUrl + "index.htm#" + url +  "\" topicId=\"" + dataNode.id  + "\">" + dataNode.text + "</a>";
						}
						else {
							breadcrumb += "<a class=\"breadcrumb\" href=\"" + Kbase._baseUrl + "index.htm#" + url +  "\" topicId=\"" + dataNode.id  + "\">" + dataNode.text + "</a>" + "&nbsp;&gt;&nbsp;";
						}
					}
                }
				
				if (Kbase._locale == 'ar' || Kbase._locale == 'fa' || Kbase._locale == 'he') {
					title = title + breadcrumb;	
				} 
				else {
					title = breadcrumb + title;
				}
                
            }
        }
    }

    Ext.getCmp('content-panel').setTitle(title);     
    
    //adding onclick event to breadcrumb links to load related topic
    var breadcrumbLinks = Ext.DomQuery.select('a.breadcrumb');
    for(var j = 0, cj = breadcrumbLinks.length; j < cj; j++) {
        var breadcrumbLink = Ext.get(breadcrumbLinks[j]);
        var url = breadcrumbLink.dom.href;
        breadcrumbLink.on('click', Kbase._H_openTopicHandler, this, url);
    }

    //----------------- Write topic links -----------------------
    var linkElems = Ext.DomQuery.select('#start-panel a');

    for(var i = 0, ci = linkElems.length; i < ci; i++) {
        var link = linkElems[i];
            
        // Skip non-local links
        if(link.href.indexOf(Kbase._baseUrl) == -1)
            continue;

        var url = link.href;
        var topicFileName = url.replace(Kbase._baseUrl, "");
        if(topicFileName != "" && topicFileName != "index.htm" && topicFileName != "#top"){
            var topicUrl = Kbase._baseUrl + "index.htm#" + topicFileName;
            link.href = topicUrl;
            Ext.get(link).on('click', Kbase._H_openTopicHandler, this, topicUrl);
        }
    //-----------------------------------------------------------          
    }
   
    // Scroll to the required hash value(sub topic)
    if(Kbase._subTopicUrl != null){
        var tagName = Kbase._subTopicUrl.replace("#", "");
        var query = "#topic-content a[name=" + tagName + "]";
        var toScroll = Ext.DomQuery.select(query);

        if(toScroll[0] != null) {
            Util.scrollToTop(Ext.get(toScroll[0]), Ext.get('topic-content').dom.parentNode.id);
        }
    }
    
    if(Kbase._isSearch == true){
        var panel = "start-panel";
        Kbase._searchHighlight.defer(1, this, [panel]);//Highlight searchTerm words in result topic content
    }
    
    // show/hide top of page link depends on page height
    var topicEl = document.getElementById('topic-content').parentNode;
    if(topicEl && topicEl.scrollHeight <= topicEl.clientHeight){
        document.getElementById('topOfPage').innerHTML = "";
    } else document.getElementById('topOfPage').innerHTML = "<a onclick='Kbase._topOfPage()'>" + Kbase.GetLocalizedResource("Top of Page") + "</a>";    
    
    //gets input values from topic file e.g (845.htm) and update the footer with this values
    if(document.getElementById('footer')){
        var variables = document.getElementById('footer').getElementsByTagName('div');
        if(variables){
            for (var v = 0; v < variables.length ; v++) {
               var inputEl = document.getElementById('footer-' + variables[v].id);
               if( inputEl ){
                   Ext.get(variables[v].id).update(inputEl.value);
               }
            }
        }
    } 
	Kbase._requestedUrl = "";
};

Kbase._searchHighlight = function(id) {
    if (!document.createElement) return;
    
    // Remove old css class 'searchword1' if exist
    var spanElems = Ext.get('topic-content').select('span[class=searchword1]');

    for (var i = 0, ci = spanElems.elements.length; i < ci; i++) {
        if(Ext.isIE)
            spanElems.elements[i].clearAttributes();
        else spanElems.elements[i].removeAttribute('class');
    }
    
    var words = Kbase._searchTerm.replace(/\+/g,' ').split(/\s+/);

	for (var w=0;w<words.length;w++) {	    
		var word = Util.trim(words[w]);
		if(words[w])
		    Kbase._highlightWord(document.getElementById(id), word, 1, Kbase._searchPartialWord);
	}
	
	Kbase._isSearch = false;
};

Kbase._highlightWord = function(node, word, instance, partial) {
    // Iterate into this nodes childNodes
    if (node.hasChildNodes()) {
        for (var cn = 0; cn < node.childNodes.length; cn++) {
            Kbase._highlightWord(node.childNodes[cn], word, instance, partial);
        }
    }

    // And do this node itself
    if (node.nodeType == 3) { // text node
        var tempNodeVal = node.nodeValue.toLowerCase();
        var tempWordVal = word.toLowerCase();

        var ni = 0;
        if (partial) {
            ni = tempNodeVal.indexOf(tempWordVal);
        } else {
            var re = new RegExp("\\b" + tempWordVal + "\\b", "gi");
            ni = tempNodeVal.search(re);
        }

        if (ni != -1) {
            var pn = node.parentNode;
            if (pn.className.substr(0, 10) != "searchword") {
                // word has not been highlighted!
                var nv = node.nodeValue;
                // Create a load of replacement nodes
                var before = document.createTextNode(nv.substr(0, ni));
                var docWordVal = nv.substr(ni, word.length);
                var after = document.createTextNode(nv.substr(ni + word.length));
                var hiWordText = document.createTextNode(docWordVal);
                var hiWord = document.createElement("span");
                hiWord.className = "searchword1";
                hiWord.appendChild(hiWordText);
                pn.insertBefore(before, node);
                pn.insertBefore(hiWord, node);
                pn.insertBefore(after, node);
                pn.removeChild(node);
            }
        }
    }
}; 

Kbase._searchFileLoaded = function(){
   var icon = null;
   try { icon = Ext.getCmp('search-Icon'); } catch(ex) {}

   if(!Kbase._searchField || !icon) {
		Kbase._searchFileLoaded.defer(30);
		return;
   }

   Kbase._searchField.enable();
   Kbase._searchField.setValue("");
   icon.enable();
}

// Ensure results panel exists
Kbase._ensureSearchResultsPanel = function() {
    var tabPanelCmp = Ext.getCmp('tab-panel');
    if(Ext.get('searchResultsPanel') == null) {  

        Kbase._searchResultsPanel = new Ext.Panel({ 
                id: 'extSearchResultsPanel', 
                layout: 'fit', 
                title: Kbase.GetLocalizedResource("Search"), 
                closable: true,
                autoScroll: true,
                html: '<div id="searchResultsPanel"><div id="searchMessage"></div><div id="searchResults"></div></div>' 
                });

        tabPanelCmp.add(Kbase._searchResultsPanel);
        tabPanelCmp.doLayout();
        tabPanelCmp.setActiveTab(Kbase._searchResultsPanel);
        
        if(Ext.isIE)
            Kbase._searchResultsPanel.body.dom.setAttribute('className', 'searchResultsPanel');
        else
            Kbase._searchResultsPanel.body.dom.setAttribute('class', 'searchResultsPanel');
            
            
        if(Ext.get('searchResults'))
            Ext.get('searchResults').on('click', Kbase._onClick_searchPanel);//used for topic content heighlight
            
            
    }else tabPanelCmp.setActiveTab(Kbase._searchResultsPanel); 
    
    Ext.get('searchResults').update("");
    Ext.get('searchMessage').update("<p>" + Kbase.GetLocalizedResource("Searching") + "...</p>");
    
    Kbase._startSearch.defer(1);
};

// ------ Perform search--------------------------
Kbase._search = function(){ 
    Kbase._startSearchTime = new Date().getTime();   
    Kbase._ensureSearchResultsPanel.defer(1);
};

Kbase._startSearch = function() {
    var ds = Kbase._jsonSearchStore;
    if(!ds.data.pages) return; 
        
    var PageCount = ds.data.pages.length;
    var searchTerm = Kbase._searchField.getValue();
    
    searchTerm = Util.trim(searchTerm);
    // Escape characters
    if(searchTerm.length == 1)
    {
        var regex = new RegExp("[^a-zA-Z0-9]", "gi");
        var result = searchTerm.match(regex);
        if(result) searchTerm = "";
    }
    if( searchTerm.length == 2 && (searchTerm.indexOf("\\\\") == 0 || searchTerm.indexOf("//") == 0) )
    {
         searchTerm = "";
    }
    
    if(searchTerm.length >= 1) {

        while( searchTerm.indexOf("<")>-1 || searchTerm.indexOf(">")>-1 || searchTerm.indexOf('"')>-1 || searchTerm.indexOf('\'')>-1 || searchTerm.indexOf("?") >-1) {
            searchTerm = searchTerm.replace("<"," ").replace(">"," ").replace('"'," ").replace('\''," ").replace("?"," ");//&lt;  &gt; &quot;
        }
    }
    // End Escape characters
    
    searchTerm = Util.trim(searchTerm);// remove multiple, leading or trailing spaces
    if(searchTerm == ""){
        var searchMessageEl = Ext.get('searchMessage');
        searchMessageEl.update("<p>" + Kbase.GetLocalizedResource("No search performed") + "</p>");
        searchMessageEl.show();
        return;
    }
    var resultCount = 0;
    var sb_pageTitle = new StringBuilder();
    var sb_pageContents = new StringBuilder();
    var sb_pageContents_allWords = new StringBuilder();
    
    
    //do check again incase if characters escaped with empty string
    if(searchTerm.length >= 1) {

        searchTerm = searchTerm.toLowerCase();
        
        Kbase._searchTerm = searchTerm;
  
        for (var i = 0, ci = ds.data.pages.length; i < ci; i++){
            var page = ds.data.pages[i];
            
            var pageTitle = page.title;
            var pageContents = page.text;
            
            //search pageTitle for all words in searchTerm   
            var pt = 0;
            if (Kbase._searchPartialWord) {
                pt = pageTitle.toLowerCase().indexOf(searchTerm);
            } else {
                var re1 = new RegExp("\\b" + searchTerm + "\\b", "gi");
                pt = pageTitle.search(re1);
            }  
                
            if(pt != -1){
                var contentUrl = page.url; 
                var topicUrl = "#" + contentUrl;
                //sb_pageTitle.append('<a href="'+ topicUrl +'" >' + pageTitle + '</a><br />' + Kbase._trimText(pageContents, searchTerm, pt)); 
                sb_pageTitle.append('<a href="'+ topicUrl +'" >' + Kbase._startSearch_highlightText(searchTerm, pageTitle) + '</a><br />' + Kbase._startSearch_highlightText(searchTerm, Kbase._trimText(pageContents, searchTerm, pt))); 
                sb_pageTitle.append("<br /><br />");  
                resultCount++;        
            }
            else {
                //search pageContents for all words in searchTerm
                var pc = 0;
                if (Kbase._searchPartialWord) {
                    pc = pageContents.toLowerCase().indexOf(searchTerm);
                } else {
                    var re2 = new RegExp("\\b" + searchTerm + "\\b", "gi");
                    pc = pageContents.search(re2);
                }
                
                if(pc != -1){
                    var contentUrl = page.url; 
                    var topicUrl = "#" + contentUrl;
                    //sb_pageContents.append('<a href="'+ topicUrl +'" >' + pageTitle + "</a><br />" + Kbase._trimText(pageContents, searchTerm, pc)); 
                    sb_pageContents.append('<a href="'+ topicUrl +'" >' + Kbase._startSearch_highlightText(searchTerm, pageTitle) + "</a><br />" + Kbase._startSearch_highlightText(searchTerm, Kbase._trimText(pageContents, searchTerm, pc))); 
                    sb_pageContents.append("<br /><br />");  
                    resultCount++; 
                }
                else {
                    //search pageContents for all words separated in searchTerm adn add to resault if any of the world exists
                    var words = Kbase._searchTerm.replace(/\+/g,' ').split(/\s+/);
                    var founWordPosition = -1;
                    var founWordIndex = 0;
                    var condition = false;
                    
                    for (var w = 0, cw = words.length; w < cw; w++) {
                        var pcs = 0;
                        if (Kbase._searchPartialWord) {
                            pcs = pageContents.toLowerCase().indexOf(words[w]);
                        } else {
                            var re3 = new RegExp("\\b" + words[w] + "\\b", "gi");
                            pcs = pageContents.search(re3);
                        }
                        if(pcs != -1) {
                            if(!condition)
                            {
                                founWordPosition = pcs;
                                founWordIndex = w;
                                condition = true;
                            }
                        }
                       // else {condition = false;  break;}
                    }
                    
                    if(condition){
                        var contentUrl = page.url; 
                        var topicUrl = "#" + contentUrl; 
                        //sb_pageContents_allWords.append('<a href="' + topicUrl + '" >' + pageTitle + "</a><br />" + Kbase._trimText(pageContents, words[0], pcs));
                        sb_pageContents_allWords.append('<a href="' + topicUrl + '" >' + Kbase._startSearch_highlightText(words[founWordIndex], pageTitle) + "</a><br />" + Kbase._startSearch_highlightText(words[founWordIndex], Kbase._trimText(pageContents, words[founWordIndex], founWordPosition)));
                        sb_pageContents_allWords.append("<br /><br />");
                        resultCount++;
                    }
                }
            }
        }

        var searchMessageEl = Ext.get('searchMessage');
        var searchResultsPanelEl = Ext.get('searchResultsPanel');
        // Display results
        if(resultCount > 0){
            var resultHtml = '<p><table class="searchResults"><tbody><tr><td class="srtd">' + sb_pageTitle.toString() + sb_pageContents.toString() + sb_pageContents_allWords.toString() + "</td></tr></tbody></table><p>";
            Ext.get('searchResults').update(resultHtml);
            var t1 = Kbase._startSearchTime;
            var t2= new Date().getTime(); 
            var t = (t2-t1)/1000; 
            var resultFound = "<p id='searchDetails' class='searchDetails'>&nbsp;" + resultCount + " " + Kbase.GetLocalizedResource("result(s) found") + "<br />("+ t +") " + Kbase.GetLocalizedResource("seconds") + "</p><br />";
            searchMessageEl.update(resultFound);
            searchMessageEl.show();
            if(searchResultsPanelEl.parent())
                searchResultsPanelEl.parent().scroll("top", 100000, false); 
                
        }else{
            searchMessageEl.update("<p>" + Kbase.GetLocalizedResource("No results found") + "</p>");
            searchMessageEl.show(); 
        }
    } else {
            searchMessageEl.update("<p>" + Kbase.GetLocalizedResource("No search performed") + "</p>");
            searchMessageEl.show();   
    }
    sb_pageTitle.clear();
    sb_pageContents.clear();
    sb_pageContents_allWords.clear();
    //Kbase._searchHighlight('searchResults');
        
    //slide out the searsh panel if search performed and the west panel is collapsed
    var westPanel = Ext.getCmp('westPanelID');
    if(westPanel && westPanel.collapsed){
        //slideOut() is an internal EXTJS method so it needs to be checkd if supported -in case of EXTJS library upgrated-
        try{
            Kbase._layout.getLayout().west.slideOut();
        }catch (e){ 
            westPanel.expand(true); 
        } 
    }
}; 

Kbase._startSearch_highlightText = function(searchTerm, textToHighlight) {

    var regex = new RegExp(searchTerm, "gi");
    var result = textToHighlight.match(regex);
    var highlightedText = textToHighlight;
    
    if(result){
        var text = textToHighlight;
        highlightedText = "";
        var pos1 = 0;
        var pos2 = text.length;
        var temptext = "";
        for(var i = 0, ci = result.length; i < ci; i++){
            if(text.indexOf(result[i]) == -1 ) continue;
            pos2 = text.indexOf(result[i]) + result[i].length;
            temptext = text.substr(0, pos2);
            var temptextPlusOne;
            if(text.length > temptext.length)
                temptextPlusOne = text.substr(0, pos2 + 1);
            else temptextPlusOne = temptext;
            text = text.substr(pos2);
            pos1 = pos2;
            if(!Kbase._searchPartialWord){
                var rex = new RegExp("\\b" + result[i] + "\\b", "gi");
                var reslt = temptextPlusOne.match(rex);
                if(reslt)
                    temptext = temptext.replace(result[i], '<span class="searchword1" >'+result[i]+'</span>');
            }
            else {
                temptext = temptext.replace(result[i], '<span class="searchword1" >'+result[i]+'</span>');
            }

            highlightedText = highlightedText + temptext;
        }
        highlightedText += text;
    }
    return highlightedText;
};

Kbase._trimText = function (pageContents, firstWord, index) {
    var textbefore = pageContents.substr(0, index);
    var text = "";
    var noOfCharToTrim = 50;
    if(textbefore.length > noOfCharToTrim){
        text = pageContents.substr( index - noOfCharToTrim, firstWord.length + noOfCharToTrim * 2 );
        text = "..." + text.substr(text.indexOf(" ") + 1);
    }else text = pageContents.substr( 0, textbefore.length + firstWord.length + noOfCharToTrim );

    text = text.substr(0, text.lastIndexOf(" ")) + "...";
    
    
    while( text.indexOf("<") > -1 || text.indexOf(">") > -1  ) {
        text = text.replace("<","&lt;").replace(">","&gt;");
    }
    
    return text;
};

Kbase._onClick_searchPanel = function(e, t){

    if(t.tagName){
        if(t.tagName.toLowerCase() == "a"){
            Kbase._isSearch = true;
            Kbase._F_openTopicByUrl(t.href);
        }else if(t.parentNode.tagName){
            if(t.parentNode.tagName.toLowerCase() == "a"){
                Kbase._isSearch = true; 
                Kbase._F_openTopicByUrl(t.parentNode.href);
            }
        }
    }
};

Kbase._highlightTextNodeEffect = function(textNode)
{
    if(textNode){
        var highlightColorEle = document.getElementById("treeNodeHighlightEffectColor");
        if(highlightColorEle && highlightColorEle.value != ""){
            textNode.highlight(highlightColorEle.value, {block:true});
        }
    }
};

// --------- String Builder Class needed by search --------
// --------- http://www.codeproject.com/KB/scripting/stringbuilder.aspx ---------
function StringBuilder(value)
{
    this.strings = new Array("");
    this.append(value);
};

// Appends the given value to the end of this instance.
StringBuilder.prototype.append = function (value)
{
    if (value)
    {
        this.strings[this.strings.length] = value;
    }
};

// Clears the string buffer
StringBuilder.prototype.clear = function ()
{
   this.strings.length = 1;
};

// Converts this instance to a String.
StringBuilder.prototype.toString = function ()
{
    return this.strings.join("");
};
// ---------- End String Builder Class--------------------


Kbase._topOfPage = function() {
    var p = Ext.get(Ext.get('topic-content').dom.parentNode.id);
    p.scroll("top", 100000, true);
};

// ------------- Utility functions ------------------
Util = {
    // Scroll a container to the top of an element.
    scrollToTop: function(elem, container) {
        var p = Ext.get(container);
        var d = Ext.get(elem);
		var dYpos = d.getY();
		if(Ext.isGecko) 
			dYpos = dYpos - 13;//FireFox skips the exact y position by 13 px
        var yOffset =  dYpos - (p.getY() - p.dom.scrollTop);
        p.scrollTo("top", yOffset, true);
    },
    // Strips <style> and <link> stylesheets from html
    stripStyles: function(html) {
        html = html.replace(/[<]link.+?[>]/g, "");
        html = html.replace(/\<style([^<]+)<[/]style>/gm, "");
        return html;
    },
    // gets the renderd element css style
    getStyle: function (oElm, strCssRule){
	var strValue = "";
	if(document.defaultView && document.defaultView.getComputedStyle){
		strValue = document.defaultView.getComputedStyle(oElm, "").getPropertyValue(strCssRule);
	}
	else if(oElm.currentStyle){
		strCssRule = strCssRule.replace(/\-(\w)/g, function (strMatch, p1){
			return p1.toUpperCase();
		});
		strValue = oElm.currentStyle[strCssRule];
	}
	return strValue;
    },
    // remove multiple, leading or trailing spaces
    trim: function (s) {
	    s = s.replace(/(^\s*)|(\s*$)/gi,"");
	    s = s.replace(/[ ]{2,}/gi," ");
	    s = s.replace(/\n /,"\n");
	    return s;
    }
    
};
// -------------End Utility functions ------------------

// Alter Ext.Ajax to work with local filesystem
Ext.apply( Ext.lib.Ajax ,
{createXhrObject:function(transactionId)
    {
        var obj,http;
        try
        {
        	// throw if IE7+ -- since it's new XHR implementation doesn't work for local file systems
		    if(Ext.isIE && document.location.protocol == 'file:') throw("IE7+ " + Kbase.GetLocalizedResource("Local file issue"));

            http = new XMLHttpRequest();

            obj = { conn:http, tId:transactionId };
        }
        catch(e)
        {
            for (var i = 0; i < this.activeX.length; ++i) {
                try
                {

                    http = new ActiveXObject(this.activeX[i]);

                    obj = { conn:http, tId:transactionId };
                    break;
                }
                catch(e) {
                }
            }
        }
        finally
        {
            return obj;
        }
    },
    handleTransactionResponse:function(o, callback, isAbort)
	{
	if (!callback) {
		this.releaseObject(o);
		return;
	}

	var httpStatus, responseObject;

	try
	{
		if (o.conn.status !== undefined) { /*&& o.conn.status != 0) {*/
			httpStatus = o.conn.status;
		}
		else {
			httpStatus = 13030;
		}
	}
	catch(e) {
		httpStatus = 13030;
	}

	if(httpStatus == 0) httpStatus = 200;

	if (httpStatus >= 200 && httpStatus < 300) {
		responseObject = this.createResponseObject(o, callback.argument);
		if (callback.success) {
			if (!callback.scope) {
				callback.success(responseObject);
			}
			else {


				callback.success.apply(callback.scope, [responseObject]);
			}
		}
	}
	else {
		switch (httpStatus) {

			case 12002:
			case 12029:
			case 12030:
			case 12031:
			case 12152:
			case 13030:
				responseObject = this.createExceptionObject(o.tId, callback.argument, (isAbort ? isAbort : false));
				if (callback.failure) {
					if (!callback.scope) {
						callback.failure(responseObject);
					}
					else {
						callback.failure.apply(callback.scope, [responseObject]);
					}
				}
				break;
			default:
				responseObject = this.createResponseObject(o, callback.argument);
				if (callback.failure) {
					if (!callback.scope) {
						callback.failure(responseObject);
					}
					else {
						callback.failure.apply(callback.scope, [responseObject]);
					}
				}
		}
	}

	this.releaseObject(o);
	responseObject = null;
}});

//Start application
Ext.onReady(Kbase.init, Kbase);
