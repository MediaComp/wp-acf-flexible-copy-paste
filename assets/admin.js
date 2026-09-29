(function ($) {
	'use strict';

	var config = window.ACFFlexibleCopyPaste || {};
	var storageKey = config.storageKey || 'acfFlexibleCopyPaste';
	var i18n = config.i18n || {};
	var flexFields = {};
	var activeMenuRow = null;
	var maxStoredLength = 8000000;
	var maxFields = 100;
	var maxRowsPerField = 250;

	function text(key, fallback) {
		return i18n[key] || fallback;
	}

	function isValidFieldKey(fieldKey) {
		return /^field_[A-Za-z0-9_]+$/.test(fieldKey || '');
	}

	function isValidLayoutName(layout) {
		return /^[A-Za-z0-9_-]+$/.test(layout || '');
	}

	function getFieldKey($field) {
		return $field.data('key') || '';
	}

	function getRows($field) {
		return $field.find('.acf-flexible-content > .values > .layout:not(.acf-clone)');
	}

	function getFieldLabel($field) {
		var label = $field.find('> .acf-label label').first().text();
		return label ? $.trim(label) : '';
	}

	function syncEditors() {
		if (window.tinyMCE && typeof window.tinyMCE.triggerSave === 'function') {
			window.tinyMCE.triggerSave();
		}
	}

	function syncInputs($root) {
		$root.find('input').each(function () {
			if (this.type === 'checkbox' || this.type === 'radio') {
				$(this).attr('checked', this.checked ? 'checked' : false);
				return;
			}

			$(this).attr('value', this.value);
		});

		$root.find('textarea').each(function () {
			$(this).text(this.value);
		});

		$root.find('option').each(function () {
			$(this).attr('selected', this.selected ? 'selected' : false);
		});
	}

	function cleanLayout($layout) {
		$layout.find('.acf-fcp-message, .acf-fcp-actions, .acf-more-layout-actions, .acf-tooltip, .acf-fc-popup').remove();

		$layout.find('script, iframe, object, embed, link, meta, base, form').remove();
		$layout.find('*').addBack().each(function () {
			var element = this;
			$.each($.makeArray(element.attributes || []), function (i, attribute) {
				var name = attribute.name.toLowerCase();
				var value = attribute.value || '';

				if (name.indexOf('on') === 0 || name === 'srcdoc' || name === 'formaction' || /^\s*javascript:/i.test(value)) {
					element.removeAttribute(attribute.name);
				}
			});
		});

		$layout.find('.acf-editor-wrap').each(function () {
			$(this).find('.wp-editor-container div, .mce-tinymce, .mce-container, .quicktags-toolbar').remove();
			$(this).find('.wp-editor-container textarea, textarea').css('display', '');
		});

		$layout.find('.acf-date-picker, .acf-time-picker, .acf-date-time-picker').each(function () {
			$(this).find('input.input').removeClass('hasDatepicker').removeAttr('id');
		});

		$layout.find('.acf-color-picker').each(function () {
			var $picker = $(this);
			var $input = $picker.find('> input').first();
			var $proxy = $picker.find('.wp-picker-container input.wp-color-picker').first();
			var value = $proxy.length ? $proxy.val() : $input.val();
			var $proxyClone;

			if ($input.length) {
				$input.val(value || '').attr('value', value || '');
			}

			if ($input.length && $proxy.length) {
				$proxyClone = $proxy.clone(false, false);
				$proxyClone.val(value || '').attr('value', value || '').removeAttr('id').css('display', '');
				$input.after($proxyClone);
			}

			$picker.find('.wp-picker-container').remove();
		});

		$layout.find('.acf-field-post-object, .acf-field-page-link').each(function () {
			$(this).find('> .acf-input span').remove();
			$(this).find('> .acf-input select').removeAttr('tabindex aria-hidden data-select2-id').removeClass();
		});

		$layout.find('.acf-field-select, .acf-field-taxonomy, .acf-field-user').each(function () {
			$(this).find('> .acf-input span.select2').remove();
			$(this).find('> .acf-input select').removeAttr('tabindex aria-hidden data-select2-id').removeClass('select2-hidden-accessible');
		});

		$layout.find('.acf-field-font-awesome').each(function () {
			$(this).find('> .acf-input span').remove();
			$(this).find('> .acf-input select').removeAttr('tabindex aria-hidden data-select2-id');
		});

		$layout.find('.acf-tab-wrap').each(function () {
			var $wrap = $(this);
			var $content = $wrap.closest('.acf-fields');
			var tabs = [];

			$wrap.find('li a').each(function () {
				tabs.push($(this));
			});

			$content.find('> .acf-field-tab').each(function () {
				var $fieldTab = $(this);

				$.each(tabs, function () {
					if ($(this).attr('data-key') === $fieldTab.attr('data-key')) {
						$fieldTab.find('> .acf-input').append($(this));
					}
				});
			});

			$wrap.remove();
		});

		$layout.find('.acf-field-accordion').each(function () {
			$(this).find('> .acf-accordion-title > .acf-accordion-icon').remove();
			$(this).after('<div class="acf-field acf-field-accordion" data-type="accordion"><div class="acf-input"><div class="acf-fields" data-endpoint="1"></div></div></div>');
		});

		$layout.removeClass('ui-sortable-helper').removeAttr('style');
		$layout.find('.ui-sortable').removeClass('ui-sortable');

		return $layout;
	}

	function getLayoutData($field, $rows) {
		var rows = [];
		var source = $field.find('.acf-flexible-content > input[type="hidden"]').attr('name') || '';

		syncEditors();
		syncInputs($rows);

		$rows.each(function () {
			var $layout = cleanLayout($(this).clone(false, false));
			var layout = $layout.attr('data-layout') || $layout.find('input[name$="[acf_fc_layout]"]').val();

			if (isValidLayoutName(layout)) {
				rows.push({
					layout: layout,
					id: $layout.attr('data-id') || '',
					html: $layout[0].outerHTML
				});
			}
		});

		return {
			fieldKey: getFieldKey($field),
			fieldLabel: getFieldLabel($field),
			source: source,
			rows: rows
		};
	}

	function saveData(data) {
		var encoded;

		try {
			encoded = JSON.stringify(data);

			if (encoded.length > maxStoredLength) {
				return false;
			}

			window.localStorage.setItem(storageKey, encoded);
			return true;
		} catch (error) {
			return false;
		}
	}

	function readData() {
		try {
			return JSON.parse(window.localStorage.getItem(storageKey) || 'null');
		} catch (error) {
			return null;
		}
	}

	function sanitizeRow(row) {
		if (!row || typeof row !== 'object' || !isValidLayoutName(row.layout) || typeof row.html !== 'string' || !row.html) {
			return null;
		}

		if (row.html.length > maxStoredLength) {
			return null;
		}

		return {
			layout: row.layout,
			id: typeof row.id === 'string' ? row.id : '',
			html: row.html
		};
	}

	function sanitizeField(field) {
		var rows = [];

		if (!field || typeof field !== 'object' || !isValidFieldKey(field.fieldKey) || !Array.isArray(field.rows)) {
			return null;
		}

		field.rows.slice(0, maxRowsPerField).forEach(function (row) {
			var cleanRow = sanitizeRow(row);

			if (cleanRow) {
				rows.push(cleanRow);
			}
		});

		if (!rows.length) {
			return null;
		}

		return {
			fieldKey: field.fieldKey,
			fieldLabel: typeof field.fieldLabel === 'string' ? field.fieldLabel : '',
			source: typeof field.source === 'string' ? field.source : '',
			rows: rows
		};
	}

	function sanitizeData(data) {
		var fields = [];
		var field;
		var row;

		if (!data || typeof data !== 'object' || data.version !== 2) {
			return null;
		}

		if (data.type === 'field') {
			field = sanitizeField(data);
			return field ? $.extend({ type: 'field', version: 2 }, field) : null;
		}

		if (data.type === 'row' && isValidFieldKey(data.fieldKey)) {
			row = sanitizeRow(data.row);
			return row ? {
				type: 'row',
				version: 2,
				fieldKey: data.fieldKey,
				fieldLabel: typeof data.fieldLabel === 'string' ? data.fieldLabel : '',
				source: typeof data.source === 'string' ? data.source : '',
				row: row
			} : null;
		}

		if (data.type === 'page' && Array.isArray(data.fields)) {
			data.fields.slice(0, maxFields).forEach(function (storedField) {
				var cleanField = sanitizeField(storedField);

				if (cleanField) {
					fields.push(cleanField);
				}
			});

			return fields.length ? { type: 'page', version: 2, fields: fields } : null;
		}

		return null;
	}

	function fieldDataFromStored(data, fieldKey) {
		var matched = null;

		data = sanitizeData(data);

		if (!data) {
			return null;
		}

		if (data.type === 'field' && data.fieldKey === fieldKey) {
			return data;
		}

		if (data.type === 'row' && data.fieldKey === fieldKey) {
			return {
				fieldKey: data.fieldKey,
				fieldLabel: data.fieldLabel,
				source: data.source,
				rows: [data.row]
			};
		}

		if (data.type === 'page') {
			data.fields.some(function (field) {
				if (field.fieldKey === fieldKey) {
					matched = field;
					return true;
				}

				return false;
			});
		}

		return matched;
	}

	function getFlexibleModel($field) {
		var key = getFieldKey($field);

		if (flexFields[key]) {
			return flexFields[key];
		}

		if (window.acf && typeof window.acf.getField === 'function') {
			flexFields[key] = window.acf.getField(key);
		}

		return flexFields[key] || null;
	}

	function sanitizePastedLayout($layout) {
		$layout.find('script, iframe, object, embed, link, meta, base, form').remove();
		$layout.find('*').addBack().each(function () {
			var element = this;
			$.each($.makeArray(element.attributes || []), function (i, attribute) {
				var name = attribute.name.toLowerCase();
				var value = attribute.value || '';

				if (name.indexOf('on') === 0 || name === 'srcdoc' || name === 'formaction' || /^\s*javascript:/i.test(value)) {
					element.removeAttribute(attribute.name);
				}
			});
		});

		return $layout;
	}

	function duplicateLayout(flexible, $layout, source, afterRow) {
		var uniqid = window.acf && window.acf.uniqid ? window.acf.uniqid() : String(Date.now());
		var target = flexible.$control().find('> input[type="hidden"]').attr('name');
		var search = source && $layout.attr('data-id') ? source + '[' + $layout.attr('data-id') + ']' : $layout.attr('data-id');
		var replace = target + '[' + uniqid + ']';
		var $clone;

		if (!target || !window.acf || typeof window.acf.rename !== 'function') {
			return null;
		}

		if (typeof flexible.allowAdd === 'function' && !flexible.allowAdd()) {
			return null;
		}

		window.acf.doAction('before_duplicate', $layout);
		$clone = $layout.clone(false, false);

		window.acf.rename({
			target: $clone,
			search: search,
			replace: replace
		});

		$clone.removeClass('acf-clone');
		$clone.find('.ui-sortable').removeClass('ui-sortable');
		$clone.attr('data-id', uniqid);

		window.acf.doAction('after_duplicate', $layout, $clone);

		if (afterRow && afterRow.length) {
			afterRow.after($clone);
		} else {
			flexible.$layoutsWrap().append($clone);
		}

		if (typeof window.acf.enable === 'function') {
			window.acf.enable($clone, flexible.cid);
		}

		window.acf.doAction('append', $clone);

		if (typeof flexible.render === 'function') {
			flexible.render();
		}

		if (typeof flexible.$input === 'function') {
			flexible.$input().trigger('change');
		}

		return $clone;
	}

	function canAddLayout(flexible, layoutName) {
		var $popup;
		var $layoutOption;
		var max;
		var count = 0;

		if (typeof flexible.$clone === 'function' && !flexible.$clone(layoutName).length) {
			return false;
		}

		if (typeof flexible.allowAdd === 'function' && !flexible.allowAdd()) {
			return false;
		}

		if (typeof flexible.$popup !== 'function' || typeof flexible.$layouts !== 'function') {
			return true;
		}

		$popup = $(flexible.$popup().html());
		$layoutOption = $popup.find('[data-layout="' + layoutName + '"]').first();

		if (!$layoutOption.length) {
			return true;
		}

		max = parseInt($layoutOption.data('max'), 10) || 0;

		if (!max) {
			return true;
		}

		flexible.$layouts().each(function () {
			if ($(this).data('layout') === layoutName) {
				count++;
			}
		});

		return count < max;
	}

	function pasteRows($field, fieldData, afterRow) {
		var flexible = getFlexibleModel($field);
		var added = [];
		var $after = afterRow ? $(afterRow) : null;

		if (!flexible || !fieldData || fieldData.fieldKey !== getFieldKey($field)) {
			return added;
		}

		fieldData.rows.forEach(function (row) {
			var html = $.parseHTML(row.html, document, false);
			var $layout = sanitizePastedLayout($(html).filter('.layout').first());
			var $added;

			if (!$layout.length || !isValidLayoutName($layout.attr('data-layout')) || $layout.attr('data-layout') !== row.layout) {
				return;
			}

			if (!canAddLayout(flexible, row.layout)) {
				return;
			}

			$added = duplicateLayout(flexible, $layout, fieldData.source, $after);

			if ($added && $added.length) {
				added.push($added[0]);
				$after = $added;
			}
		});

		return added;
	}

	function showFieldMessage($field, message, type) {
		var $actions = $field.find('> .acf-label .acf-fcp-actions');
		var $notice = $field.find('> .acf-label .acf-fcp-message');

		if (!$actions.length) {
			return;
		}

		if (!$notice.length) {
			$notice = $('<span class="acf-fcp-message"></span>').appendTo($actions);
		}

		$notice.text(message).removeClass('is-success is-error').addClass(type === 'success' ? 'is-success' : 'is-error');
		clearTimeout($notice.data('acfFcpTimer'));
		$notice.data('acfFcpTimer', setTimeout(function () {
			$notice.text('').removeClass('is-success is-error');
		}, 5000));
	}

	function showRowMessage(row, message, type) {
		var $row = $(row);
		var $target = $row.find('> .acf-fc-layout-handle').first();
		var $notice;

		if (!$target.length) {
			$target = $row.children().first();
		}

		if (!$target.length) {
			return;
		}

		$notice = $target.find('.acf-fcp-message').first();

		if (!$notice.length) {
			$notice = $('<span class="acf-fcp-message"></span>').appendTo($target);
		}

		$notice.text(message).removeClass('is-success is-error').addClass(type === 'success' ? 'is-success' : 'is-error');
		clearTimeout($notice.data('acfFcpTimer'));
		$notice.data('acfFcpTimer', setTimeout(function () {
			$notice.text('').removeClass('is-success is-error');
		}, 5000));
	}

	function setButtonState(button, message) {
		var $button = $(button);
		var original = $button.data('acfFcpOriginalText') || $button.text();

		$button.data('acfFcpOriginalText', original).text(message);
		clearTimeout($button.data('acfFcpTimer'));
		$button.data('acfFcpTimer', setTimeout(function () {
			$button.text(original);
		}, 2200));
	}

	function copyField($field) {
		var fieldData = getLayoutData($field, getRows($field));

		if (!fieldData.rows.length) {
			showFieldMessage($field, text('noRows', 'There are no layouts to copy.'), 'error');
			return;
		}

		if (!saveData($.extend({ type: 'field', version: 2, createdAt: new Date().toISOString(), postId: config.postId || 0 }, fieldData))) {
			showFieldMessage($field, text('storageError', 'Browser storage is unavailable.'), 'error');
			return;
		}

		showFieldMessage($field, text('copied', 'Flexible Content copied.'), 'success');
	}

	function pasteField($field) {
		var fieldData = fieldDataFromStored(readData(), getFieldKey($field));
		var added;

		if (!fieldData || !fieldData.rows.length) {
			showFieldMessage($field, text('noData', 'There is no copied Flexible Content data.'), 'error');
			return;
		}

		if (!window.confirm(text('confirmPaste', 'Append copied Flexible Content layouts to this field?'))) {
			return;
		}

		added = pasteRows($field, fieldData);

		if (!added.length) {
			showFieldMessage($field, text('invalid', 'Copied data is invalid.'), 'error');
			return;
		}

		showFieldMessage($field, text('pasted', 'Flexible Content pasted.'), 'success');
	}

	function copyRow(row) {
		var $row = $(row);
		var $field = $row.closest('.acf-field-flexible-content[data-key]');
		var fieldData;

		if (!$field.length) {
			return;
		}

		fieldData = getLayoutData($field, $row);

		if (!fieldData.rows.length) {
			showRowMessage(row, text('invalid', 'Copied data is invalid.'), 'error');
			return;
		}

		if (!saveData({
			type: 'row',
			version: 2,
			createdAt: new Date().toISOString(),
			postId: config.postId || 0,
			fieldKey: fieldData.fieldKey,
			fieldLabel: fieldData.fieldLabel,
			source: fieldData.source,
			row: fieldData.rows[0]
		})) {
			showRowMessage(row, text('storageError', 'Browser storage is unavailable.'), 'error');
			return;
		}

		showRowMessage(row, text('copiedSection', 'Section copied.'), 'success');
	}

	function pasteAfterRow(row) {
		var $row = $(row);
		var $field = $row.closest('.acf-field-flexible-content[data-key]');
		var fieldData = fieldDataFromStored(readData(), getFieldKey($field));
		var added;

		if (!fieldData || !fieldData.rows.length) {
			showRowMessage(row, text('noData', 'There is no copied Flexible Content data.'), 'error');
			return;
		}

		if (!window.confirm(text('confirmPasteAfter', 'Paste copied section after this section?'))) {
			return;
		}

		added = pasteRows($field, fieldData, $row);

		if (!added.length) {
			showRowMessage(row, text('invalid', 'Copied data is invalid.'), 'error');
			return;
		}

		showRowMessage(added[added.length - 1], text('pastedSection', 'Section pasted.'), 'success');
	}

	function addFieldButtons($field) {
		var $label = $field.find('> .acf-label');
		var $actions;
		var $copy;
		var $paste;

		if (!$label.length || $label.find('.acf-fcp-actions').length) {
			return;
		}

		$actions = $('<div class="acf-fcp-actions"></div>').appendTo($label);
		$copy = $('<button type="button" class="button acf-fcp-button"></button>').text(text('copy', 'Copy all layouts')).appendTo($actions);
		$paste = $('<button type="button" class="button acf-fcp-button"></button>').text(text('paste', 'Paste layouts')).appendTo($actions);

		$copy.on('click', function () {
			copyField($field);
		});

		$paste.on('click', function () {
			pasteField($field);
		});
	}

	function getNativeMenuTargetRow() {
		var $menu = $('.acf-more-layout-actions').last();
		var data = $menu.data('acf') || $menu.data() || {};
		var target = data.data && data.data.target ? data.data.target : data.target;

		if (target && target.jquery && target.length) {
			return target.closest('.layout')[0] || null;
		}

		if (target && target.nodeType === 1) {
			return target.closest('.layout');
		}

		return activeMenuRow;
	}

	function handleMenuClick(event) {
		var item = event.target.closest('.acf-fcp-copy-layout, .acf-fcp-paste-after-layout');
		var row;
		var action;

		if (!item) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();

		row = getNativeMenuTargetRow();
		action = item.getAttribute('data-action');

		if (!row) {
			return;
		}

		if (action === 'copy-layout') {
			copyRow(row);
		}

		if (action === 'paste-after-layout') {
			pasteAfterRow(row);
		}

		$(item).closest('.acf-more-layout-actions').remove();
	}

	function rememberMenuRow(event) {
		var control = event.target.closest('.acf-fc-layout-controls, .acf-fc-layout-handle, [data-name="more-layout"], [data-event="more-layout"]');
		var row = control ? control.closest('.acf-field-flexible-content .layout:not(.acf-clone)') : null;

		if (row) {
			activeMenuRow = row;
		}
	}

	function init(context) {
		$(context || document).find('.acf-field-flexible-content[data-key]').addBack('.acf-field-flexible-content[data-key]').each(function () {
			addFieldButtons($(this));
			flexFields[getFieldKey($(this))] = getFlexibleModel($(this));
		});

	}

	if (config.canEdit) {
		$(document).on('click', rememberMenuRow);
		document.addEventListener('click', handleMenuClick, true);

		$(document).ready(function () {
			init(document);
		});

		if (window.acf && typeof window.acf.addAction === 'function') {
			window.acf.addAction('ready_field/type=flexible_content', function (field) {
				flexFields[field.data.key] = field;
				addFieldButtons(field.$el);
			});

			window.acf.addAction('append', function ($el) {
				init($el);
			});
		}
	}
})(jQuery);
