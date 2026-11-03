/*
  Font Replacer for After Effects
  Version 1.0 | Requires Adobe After Effects 24.5+
  Uses native app.project.usedFonts and app.project.replaceFont.
  IMPORTANT: replaceFont is NOT undoable. Save a backup first.
*/
(function fontReplacer(thisObj) {
    var TITLE = "Font Replacer";
    var VERSION = "1.0";
    var usedEntries = [];
    var installedEntries = [];
    var visibleInstalled = [];

    function safeString(value) { return value === undefined || value === null ? "" : String(value); }
    function fontLabel(font) {
        var family = safeString(font.familyName);
        var style = safeString(font.styleName);
        return family + (style ? " — " + style : "");
    }
    function versionSupported() {
        var match = safeString(app.version).match(/^(\d+)\.(\d+)/);
        if (!match) return false;
        var major = parseInt(match[1], 10), minor = parseInt(match[2], 10);
        return major > 24 || (major === 24 && minor >= 5);
    }
    if (!versionSupported()) {
        alert(TITLE + " requires After Effects 24.5 or newer.\nCurrent version: " + app.version);
        return;
    }

    var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", TITLE + " " + VERSION, undefined, { resizeable: true });
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 8;
    win.margins = 12;
    win.minimumSize = [440, 460];

    var header = win.add("group");
    header.orientation = "row";
    header.alignChildren = ["left", "center"];
    var heading = header.add("statictext", undefined, "FONT REPLACER");
    heading.characters = 24;
    var versionLabel = header.add("statictext", undefined, "v" + VERSION + "  |  AE 24.5+");

    var usagePanel = win.add("panel", undefined, "Fonts used in project");
    usagePanel.orientation = "column";
    usagePanel.alignChildren = ["fill", "top"];
    usagePanel.margins = 10;
    usagePanel.alignment = ["fill", "fill"];
    var usageHeader = usagePanel.add("group");
    usageHeader.orientation = "row";
    usageHeader.alignChildren = ["left", "center"];
    var usageStatus = usageHeader.add("statictext", undefined, "Scan the current project to begin.");
    usageStatus.alignment = ["fill", "center"];
    var scanButton = usageHeader.add("button", undefined, "Scan Project");
    var usedList = usagePanel.add("listbox", undefined, [], {
        multiselect: false,
        numberOfColumns: 3,
        showHeaders: true,
        columnTitles: ["Used font", "Uses", "Status"],
        columnWidths: [265, 48, 90]
    });
    usedList.preferredSize.height = 164;
    usedList.alignment = ["fill", "fill"];

    var targetPanel = win.add("panel", undefined, "Replacement font (installed)");
    targetPanel.orientation = "column";
    targetPanel.alignChildren = ["fill", "top"];
    targetPanel.margins = 10;
    targetPanel.alignment = ["fill", "fill"];
    var searchRow = targetPanel.add("group");
    searchRow.orientation = "row";
    searchRow.alignChildren = ["left", "center"];
    searchRow.add("statictext", undefined, "Search:");
    var fontSearch = searchRow.add("edittext", undefined, "");
    fontSearch.alignment = ["fill", "center"];
    fontSearch.characters = 25;
    var clearButton = searchRow.add("button", undefined, "Clear");
    var installedList = targetPanel.add("listbox", undefined, [], {
        multiselect: false,
        numberOfColumns: 2,
        showHeaders: true,
        columnTitles: ["Family / Style", "PostScript name"],
        columnWidths: [235, 170]
    });
    installedList.preferredSize.height = 165;
    installedList.alignment = ["fill", "fill"];
    var foundStatus = targetPanel.add("statictext", undefined, "Loading installed fonts...");

    var options = win.add("group");
    options.orientation = "row";
    options.alignChildren = ["left", "center"];
    var noFontLockingBox = options.add("checkbox", undefined, "Force selected font (no glyph fallback)");
    noFontLockingBox.value = false;
    noFontLockingBox.helpTip = "If enabled, missing glyphs may appear instead of an automatic fallback font.";

    var actionRow = win.add("group");
    actionRow.orientation = "row";
    actionRow.alignment = ["fill", "top"];
    var replaceButton = actionRow.add("button", undefined, "Replace selected font");
    replaceButton.alignment = ["fill", "center"];
    replaceButton.enabled = false;
    var refreshButton = actionRow.add("button", undefined, "Refresh fonts");

    var footer = win.add("statictext", undefined, "Warning: replacing fonts cannot be undone. Save a project copy first.", { multiline: true });
    footer.alignment = ["fill", "top"];

    function updateReplaceButton() {
        replaceButton.enabled = !!(usedList.selection && installedList.selection);
    }
    function populateUsedFonts(preferredPS) {
        usedEntries = [];
        usedList.removeAll();
        var fonts;
        try { fonts = app.project.usedFonts; }
        catch (e) {
            usageStatus.text = "Cannot read project fonts.";
            alert("Scanning failed:\n" + e.toString());
            updateReplaceButton();
            return;
        }
        for (var i = 0; i < fonts.length; i++) {
            var entry = fonts[i];
            var f = entry.font;
            var ps, label, status;
            try {
                ps = safeString(f.postScriptName);
                label = fontLabel(f);
                status = f.isSubstitute ? "MISSING" : "Available";
            } catch (e2) { continue; }
            var row = usedList.add("item", label || ps);
            row.subItems[0].text = safeString(entry.usedAt ? entry.usedAt.length : 0);
            row.subItems[1].text = status;
            row.helpTip = ps;
            usedEntries.push({ font: f, ps: ps, label: label });
            if (preferredPS && ps === preferredPS) usedList.selection = row;
        }
        usageStatus.text = usedEntries.length + " font(s) found";
        updateReplaceButton();
    }
    function gatherInstalledFonts() {
        installedEntries = [];
        var all;
        try { all = app.fonts.allFonts; }
        catch (e) { alert("Could not read installed fonts:\n" + e.toString()); return; }
        for (var i = 0; i < all.length; i++) {
            var family = all[i];
            for (var j = 0; j < family.length; j++) {
                var font = family[j];
                try {
                    if (font.isSubstitute) continue;
                    var ps = safeString(font.postScriptName);
                    var label = fontLabel(font);
                    installedEntries.push({ font: font, ps: ps, label: label, query: (label + " " + ps).toLowerCase() });
                } catch (e2) {}
            }
        }
        installedEntries.sort(function(a, b) {
            var al = a.label.toLowerCase(), bl = b.label.toLowerCase();
            return al < bl ? -1 : (al > bl ? 1 : 0);
        });
    }
    function filterInstalledFonts() {
        var term = safeString(fontSearch.text).toLowerCase();
        var previousPS = null;
        if (installedList.selection && visibleInstalled[installedList.selection.index]) {
            previousPS = visibleInstalled[installedList.selection.index].ps;
        }
        visibleInstalled = [];
        installedList.removeAll();
        for (var i = 0; i < installedEntries.length; i++) {
            var e = installedEntries[i];
            if (term && e.query.indexOf(term) === -1) continue;
            visibleInstalled.push(e);
            var row = installedList.add("item", e.label);
            row.subItems[0].text = e.ps;
            if (previousPS && previousPS === e.ps) installedList.selection = row;
        }
        foundStatus.text = visibleInstalled.length + " of " + installedEntries.length + " installed font styles";
        updateReplaceButton();
    }
    scanButton.onClick = function() { populateUsedFonts(); };
    usedList.onChange = updateReplaceButton;
    installedList.onChange = updateReplaceButton;
    fontSearch.onChanging = filterInstalledFonts;
    clearButton.onClick = function() { fontSearch.text = ""; filterInstalledFonts(); };
    refreshButton.onClick = function() { gatherInstalledFonts(); filterInstalledFonts(); populateUsedFonts(); };
    replaceButton.onClick = function() {
        if (!usedList.selection || !installedList.selection) return;
        var from = usedEntries[usedList.selection.index];
        var to = visibleInstalled[installedList.selection.index];
        if (!from || !to) return;
        if (from.ps === to.ps) {
            alert("Both fonts have the same PostScript name. Select a different replacement.");
            return;
        }
        var msg = "Replace all occurrences of:\n\n" + from.label + "\n(" + from.ps + ")\n\nwith:\n\n" + to.label + "\n(" + to.ps + ")\n\nTHIS CANNOT BE UNDONE.\nSave a backup of your .aep first.\n\nContinue?";
        if (!confirm(msg)) return;
        try {
            var changed = app.project.replaceFont(from.font, to.font, !!noFontLockingBox.value);
            populateUsedFonts(to.ps);
            if (changed) {
                alert("Font replaced successfully.\n\nCheck text layout, line breaks and missing glyphs before saving.");
            } else {
                alert("After Effects did not report any modified layer. The font may no longer be used.");
            }
        } catch (e) {
            alert("Font replacement failed:\n" + e.toString());
            populateUsedFonts();
        }
    };

    win.onResizing = win.onResize = function() { this.layout.resize(); };
    gatherInstalledFonts();
    filterInstalledFonts();
    populateUsedFonts();
    win.layout.layout(true);
    if (win instanceof Window) { win.center(); win.show(); }
})(this);
