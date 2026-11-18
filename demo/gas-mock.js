/* Simulación mínima de Google Apps Script para el MODO DEMOSTRACIÓN.
   Permite ejecutar el mismo Code.gs dentro del navegador, guardando las hojas en este dispositivo. */
(function (g) {
  'use strict';
  var CLAVE = 'nec:demoHojas';
  var almacen = (function () { try { return g.localStorage; } catch (e) { return null; } })();
  var datos = {};
  try { datos = JSON.parse((almacen && almacen.getItem(CLAVE)) || '{}') || {}; } catch (e) { datos = {}; }
  var orden = Object.keys(datos);
  function guardar() { try { almacen && almacen.setItem(CLAVE, JSON.stringify(datos)); } catch (e) {} }

  function Hoja(nombre) { this.nombre = nombre; }
  Hoja.prototype = {
    _v: function () { return datos[this.nombre]; },
    getName: function () { return this.nombre; },
    getLastRow: function () { var v = this._v(); for (var i = v.length; i > 0; i--) if (v[i - 1].some(function (x) { return x !== ''; })) return i; return 0; },
    getLastColumn: function () { var m = 0; this._v().forEach(function (f) { for (var j = f.length; j > 0; j--) if (f[j - 1] !== '') { if (j > m) m = j; break; } }); return m; },
    getRange: function (r, c, nr, nc) { return new Rango(this, r, c, nr || 1, nc || 1); },
    getDataRange: function () { return new Rango(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); },
    appendRow: function (fila) { var v = this._v(); v.length = this.getLastRow(); v.push(fila.map(function (x) { return x == null ? '' : x; })); guardar(); return this; },
    deleteRow: function (n) { this._v().splice(n - 1, 1); guardar(); return this; },
    getMaxRows: function () { return Math.max(1000, this._v().length); },
    setFrozenRows: function () { return this; }
  };
  function Rango(h, r, c, nr, nc) { this.h = h; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
  Rango.prototype = {
    getValues: function () {
      var v = this.h._v(), out = [];
      for (var i = 0; i < this.nr; i++) { var f = v[this.r - 1 + i] || [], o = []; for (var j = 0; j < this.nc; j++) { var x = f[this.c - 1 + j]; o.push(x == null ? '' : x); } out.push(o); }
      return out;
    },
    setValues: function (vals) {
      var v = this.h._v();
      for (var i = 0; i < vals.length; i++) {
        var fi = this.r - 1 + i; while (v.length <= fi) v.push([]);
        for (var j = 0; j < vals[i].length; j++) { var cj = this.c - 1 + j; while (v[fi].length < cj) v[fi].push(''); v[fi][cj] = vals[i][j] == null ? '' : vals[i][j]; }
      }
      guardar(); return this;
    },
    setValue: function (x) { return this.setValues([[x]]); },
    setNumberFormat: function () { return this; },
    setFontWeight: function () { return this; }
  };
  var libro = {
    getSheetByName: function (n) { return datos[n] ? new Hoja(n) : null; },
    insertSheet: function (n) { datos[n] = []; orden.push(n); guardar(); return new Hoja(n); },
    getSheets: function () { return orden.filter(function (n) { return datos[n]; }).map(function (n) { return new Hoja(n); }); },
    deleteSheet: function (h) { delete datos[h.nombre]; guardar(); }
  };
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  g.SpreadsheetApp = { getActiveSpreadsheet: function () { return libro; } };
  g.LockService = { getScriptLock: function () { return { tryLock: function () { return true; }, releaseLock: function () {} }; } };
  g.Logger = { log: function () {} };
  g.Utilities = {
    formatDate: function (d, zona, f) {
      var y = String(d.getFullYear());
      return f.replace('yyyy', y).replace('yy', y.slice(2)).replace('MM', dos(d.getMonth() + 1)).replace('dd', dos(d.getDate()))
              .replace('HH', dos(d.getHours())).replace('mm', dos(d.getMinutes())).replace('ss', dos(d.getSeconds()));
    }
  };
  g.ContentService = { MimeType: { JSON: 'json' }, createTextOutput: function (t) { return { t: t, setMimeType: function () { return this; } }; } };
  g.__GAS_RESET__ = function () { datos = {}; orden = []; guardar(); };
})(typeof window !== 'undefined' ? window : globalThis);
