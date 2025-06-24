function highlightWord(node, word, instance, partial) {
  // Iterate into this nodes childNodes
  if (node.hasChildNodes) {
    for (var cn=0;cn<node.childNodes.length;cn++) {
      highlightWord(node.childNodes[cn],word,instance,partial);
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
        var re = new RegExp("\\b" + tempWordVal + "\\b", "i");
        ni = tempNodeVal.search(re);
    }
            
    if (ni != -1) {    
        var pn = node.parentNode;
        if (pn.className.substr(0,10) != "searchword") {
            // word has not already been highlighted!
            var nv = node.nodeValue;
            // Create a load of replacement nodes
            var before = document.createTextNode(nv.substr(0,ni));
            var docWordVal = nv.substr(ni,word.length);
            var after = document.createTextNode(nv.substr(ni+word.length));
            var hiWordText = document.createTextNode(docWordVal);
            var hiWord = document.createElement("span");
            hiWord.className = "searchword" + (instance % 5 + 1);
            hiWord.appendChild(hiWordText);
            pn.insertBefore(before,node);
            pn.insertBefore(hiWord,node);
            pn.insertBefore(after,node);
            pn.removeChild(node);
        }
    }
  }
}

function searchHighlight() {
  if (!document.createElement) return;
  ref = window.location.search;
  if (ref.indexOf('?') == -1) return;
  qs = ref.substr(ref.indexOf('?')+1);
  qsa = qs.split('&');
  var partial = true;  
  for (i=0;i<qsa.length;i++) {
    if (ref.indexOf('=') == -1) return;
    qsip = qsa[i].split('=');
    if (qsip[0] == 'partial') {
        partial = (qsip[1] == 'true');
    }
    if (qsip[0] == 'terms') {
      words = unescape(qsip[1].replace(/\+/g,' ')).split(/\s+/);
      for (w=0;w<words.length;w++) {
        highlightWord(document.getElementsByTagName("body")[0],words[w],w,partial);
      }
    }
  }
}

window.onload = searchHighlight;
