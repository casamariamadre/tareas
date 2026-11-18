/**
 * Necesidades y mantenimiento – Puente entre la app y Google Sheets
 * ---------------------------------------------------------------
 * 1. Escribe el PIN común en PIN (obligatorio; sin él la app no deja entrar).
 * 2. Ejecuta una vez la función  configurar  (menú ▶ Ejecutar) y acepta los permisos.
 *    Crea las pestañas Tareas, Espacios, Categorías, Personas y Registro.
 * 3. Implementar ▸ Nueva implementación ▸ Aplicación web
 *      Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier usuario
 * 4. Copia la URL que termina en /exec y pégala en config.js de la app.
 *
 * Para cambiar el código más adelante: Implementar ▸ Gestionar implementaciones ▸ ✏️ ▸
 * Versión nueva. NUNCA «Nueva implementación» (cambiaría la dirección).
 */

// ====== AJUSTES (puedes cambiarlos) ======
var PIN = '';              // PIN común, OBLIGATORIO. Ejemplo: '2468'. Lo escriben todas las personas al entrar.
var ZONA = 'Europe/Madrid';
var VERSION = '1.1.0';

var ESTADOS = ['Pendiente', 'En curso', 'Esperando', 'Hecha'];
var PRIORIDADES = ['Alta', 'Media', 'Baja'];

// ====== Estructura de datos ======
// Para crecer: añade columnas AL FINAL de una hoja o pestañas nuevas. No cambies los nombres existentes.
var HOJAS = {
  'Tareas': ['ID', 'Título', 'Descripción', 'Categoría ID', 'Categoría', 'Espacio ID', 'Espacio', 'Lugar exacto',
             'Prioridad', 'Urgente', 'Estado', 'Responsable', 'Fecha límite', 'Notas',
             'Creado por', 'Creado el', 'Modificado por', 'Modificado el', 'Hecha el'],
  'Espacios': ['ID', 'Nombre', 'Código', 'Zona', 'Activo', 'Orden'],
  'Categorías': ['ID', 'Nombre', 'Activo', 'Orden'],
  'Personas': ['ID', 'Nombre', 'Activo', 'Orden'],
  'Registro': ['Fecha', 'Quién', 'Acción', 'ID', 'Detalle']
};

// Listas editables desde la app. «personas»: quién puede entrar en la app y a quién se asignan tareas. «enTareas»: columnas de Tareas que guardan el ID y el nombre.
var LISTAS = {
  espacios:     { hoja: 'Espacios',     pref: 'E', campos: ['nombre', 'codigo', 'zona'], enTareas: ['Espacio ID', 'Espacio'] },
  categorias:   { hoja: 'Categorías',   pref: 'C', campos: ['nombre'],                   enTareas: ['Categoría ID', 'Categoría'] },
  personas:     { hoja: 'Personas',     pref: 'P', campos: ['nombre'],                   enTareas: null }
};
var COLUMNA = { nombre: 'Nombre', codigo: 'Código', zona: 'Zona' };

var INICIALES = {
  espacios: ['Entrada y recepción', 'Capilla u oratorio', 'Salas', 'Habitaciones', 'Baños', 'Comedor', 'Cocina',
             'Pasillos y escaleras', 'Cubierta y tejado', 'Sala de calderas e instalaciones', 'Almacén',
             'Exteriores y jardín', 'Otros'],
  categorias: ['Fontanería', 'Electricidad', 'Pintura', 'Carpintería y cerrajería', 'Albañilería',
               'Calefacción y climatización', 'Mobiliario', 'Jardín y exteriores', 'Seguridad',
               'Faltas y compras', 'Otros'],
  personas: ['Viviane', 'Rafael', 'Gema', 'Carlos']
};

// =====================================================================
// CONFIGURACIÓN INICIAL (ejecutar una vez desde el editor; se puede repetir sin perder datos)
// =====================================================================
function configurar() {
  var ss = libro_();
  Object.keys(HOJAS).forEach(function (nombre) {
    var sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    var cab = HOJAS[nombre];
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold');
      sh.setFrozenRows(1);
    } else {
      asegurarCabeceras_(nombre);
    }
    // Todo como texto (columnas completas): evita que Sheets convierta fechas o códigos.
    sh.getRange(2, 1, sh.getMaxRows() - 1, Math.max(sh.getLastColumn(), cab.length)).setNumberFormat('@');
  });
  Object.keys(INICIALES).forEach(function (lista) {
    var sh = ss.getSheetByName(LISTAS[lista].hoja);
    if (sh.getLastRow() < 2 && INICIALES[lista].length) {
      var cab = HOJAS[LISTAS[lista].hoja];
      var filas = INICIALES[lista].map(function (n, i) {
        var o = { 'ID': LISTAS[lista].pref + rellena_(i + 1), 'Nombre': n, 'Activo': 'Sí', 'Orden': String(i + 1) };
        return cab.map(function (c) { return o[c] == null ? '' : o[c]; });
      });
      sh.getRange(2, 1, filas.length, cab.length).setValues(filas);
    }
  });
  var h1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (h1 && ss.getSheets().length > 1 && h1.getLastRow() === 0) ss.deleteSheet(h1);
  Logger.log('Listo: pestañas creadas.');
  return 'ok';
}

// =====================================================================
// ENTRADA DE LA APP
// =====================================================================
function doGet() {
  return json_({ ok: true, datos: { app: 'Necesidades', version: VERSION } });
}

function doPost(e) {
  var pet;
  try { pet = JSON.parse(e.postData.contents); }
  catch (err) { return json_({ ok: false, error: 'Petición no válida.' }); }
  return json_(atender(pet));
}

/** Lógica común (también la usa el modo demostración de la app). */
function atender(pet) {
  try {
    if (!pet) return { ok: false, error: 'Petición no válida.' };
    if (pet.accion === 'ping') return { ok: true, datos: { version: VERSION, personas: personasActivas_() } };
    if (!PIN) return { ok: false, error: 'Falta poner el PIN en Code.gs (variable PIN).', codigo: 'SIN_PIN' };
    if (String(pet.pin || '') !== PIN) return { ok: false, error: 'PIN incorrecto.', codigo: 'CLAVE' };
    var quien = texto_(pet.quien, 80);
    if (personasActivas_().indexOf(quien) < 0) {
      return { ok: false, error: (quien ? '«' + quien + '» ya no está en la lista de personas.' : 'Elige quién eres.') + ' Vuelve a entrar.', codigo: 'PERSONA' };
    }
    var d = pet.datos || {};
    switch (pet.accion) {
      case 'inicial': return { ok: true, datos: estado_() };
      case 'guardarTarea': return conBloqueo_(function () { return guardarTarea_(d, quien); });
      case 'cambiarEstado': return conBloqueo_(function () { return cambiarEstado_(d.id, d.estado, quien); });
      case 'borrarTarea': return conBloqueo_(function () { return borrarTarea_(d.id, quien); });
      case 'guardarElemento': return conBloqueo_(function () { return guardarElemento_(d.lista, d.elemento || {}, quien); });
      case 'borrarElemento': return conBloqueo_(function () { return borrarElemento_(d.lista, d.id, quien); });
      default: return { ok: false, error: 'Acción desconocida.' };
    }
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

function conBloqueo_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'Otra persona está guardando. Inténtalo de nuevo.' };
  try {
    var r = fn();
    r.datos = r.datos || {};
    r.datos.estado = estado_();
    return r;
  } finally {
    lock.releaseLock();
  }
}

// =====================================================================
// LECTURA
// =====================================================================
function estado_() {
  var tareas = filas_('Tareas').filter(function (t) { return t['ID']; }).map(function (t) {
    return {
      id: String(t['ID']), titulo: t['Título'], descripcion: t['Descripción'],
      categoriaId: String(t['Categoría ID'] || ''), categoria: t['Categoría'],
      espacioId: String(t['Espacio ID'] || ''), espacio: t['Espacio'], lugar: t['Lugar exacto'],
      prioridad: t['Prioridad'] || 'Media', urgente: t['Urgente'] === 'Sí', estado: t['Estado'] || 'Pendiente',
      responsable: t['Responsable'], limite: fecha_(t['Fecha límite']), notas: t['Notas'],
      creadoPor: t['Creado por'], creadoEl: marca_(t['Creado el']),
      modificadoPor: t['Modificado por'], modificadoEl: marca_(t['Modificado el']), hechaEl: marca_(t['Hecha el'])
    };
  });
  var listas = {};
  Object.keys(LISTAS).forEach(function (k) {
    listas[k] = filas_(LISTAS[k].hoja).filter(function (f) { return f['ID'] && f['Nombre']; }).map(function (f) {
      var o = { id: String(f['ID']), nombre: String(f['Nombre']), activo: f['Activo'] !== 'No', orden: Number(f['Orden']) || 0 };
      LISTAS[k].campos.forEach(function (c) { if (c !== 'nombre') o[c] = f[COLUMNA[c]] == null ? '' : String(f[COLUMNA[c]]); });
      return o;
    }).sort(function (a, b) { return a.orden - b.orden || a.nombre.localeCompare(b.nombre); });
  });
  return {
    tareas: tareas, espacios: listas.espacios, categorias: listas.categorias, personas: listas.personas,
    ajustes: { version: VERSION, estados: ESTADOS, prioridades: PRIORIDADES }
  };
}

// =====================================================================
// TAREAS
// =====================================================================
function guardarTarea_(d, quien) {
  var t = d.tarea || {};
  var titulo = texto_(t.titulo, 150);
  if (!titulo) throw new Error('Falta el título.');
  var prioridad = PRIORIDADES.indexOf(t.prioridad) >= 0 ? t.prioridad : 'Media';
  var estado = ESTADOS.indexOf(t.estado) >= 0 ? t.estado : 'Pendiente';
  var limite = texto_(t.limite, 10);
  if (limite && !/^\d{4}-\d{2}-\d{2}$/.test(limite)) throw new Error('Fecha límite no válida.');
  var cat = buscarElemento_('categorias', t.categoriaId);
  var esp = buscarElemento_('espacios', t.espacioId);
  var ahora = ahora_();
  var o = {
    'Título': titulo, 'Descripción': texto_(t.descripcion, 2000),
    'Categoría ID': cat ? cat.id : '', 'Categoría': cat ? cat.nombre : '',
    'Espacio ID': esp ? esp.id : '', 'Espacio': esp ? esp.nombre : '', 'Lugar exacto': texto_(t.lugar, 120),
    'Prioridad': prioridad, 'Urgente': t.urgente ? 'Sí' : 'No', 'Estado': estado,
    'Responsable': texto_(t.responsable, 60), 'Fecha límite': limite, 'Notas': texto_(t.notas, 2000),
    'Modificado por': quien, 'Modificado el': ahora
  };
  var fila = t.id ? buscarFila_('Tareas', 'ID', t.id) : 0;
  if (t.id && !fila) throw new Error('Esa tarea ya no existe (¿la borró otra persona?).');
  if (fila) {
    var antes = leerFila_('Tareas', fila);
    o['Hecha el'] = estado === 'Hecha' ? (antes['Hecha el'] || ahora) : '';
    escribirFila_('Tareas', fila, o);
    registrar_(quien, 'Modificar tarea', t.id, titulo);
    return { ok: true, datos: { id: t.id } };
  }
  var id = nuevoId_();
  o['ID'] = id; o['Creado por'] = quien; o['Creado el'] = ahora;
  o['Hecha el'] = estado === 'Hecha' ? ahora : '';
  anadirFila_('Tareas', o);
  registrar_(quien, 'Nueva tarea', id, titulo);
  return { ok: true, datos: { id: id } };
}

function cambiarEstado_(id, estado, quien) {
  if (ESTADOS.indexOf(estado) < 0) throw new Error('Estado no válido.');
  var fila = buscarFila_('Tareas', 'ID', id);
  if (!fila) throw new Error('Esa tarea ya no existe.');
  var antes = leerFila_('Tareas', fila);
  var ahora = ahora_();
  escribirFila_('Tareas', fila, {
    'Estado': estado, 'Modificado por': quien, 'Modificado el': ahora,
    'Hecha el': estado === 'Hecha' ? (antes['Hecha el'] || ahora) : ''
  });
  registrar_(quien, 'Estado: ' + estado, id, antes['Título']);
  return { ok: true, datos: { id: id } };
}

function borrarTarea_(id, quien) {
  var fila = buscarFila_('Tareas', 'ID', id);
  if (!fila) throw new Error('Esa tarea ya no existe.');
  var antes = leerFila_('Tareas', fila);
  libro_().getSheetByName('Tareas').deleteRow(fila);
  registrar_(quien, 'Borrar tarea', id, antes['Título']);
  return { ok: true, datos: { id: id } };
}

// =====================================================================
// LISTAS (espacios, categorías, personas)
// =====================================================================
function guardarElemento_(lista, e, quien) {
  var L = LISTAS[lista];
  if (!L) throw new Error('Lista desconocida.');
  var nombre = texto_(e.nombre, 80);
  if (!nombre) throw new Error('Falta el nombre.');
  var existentes = filas_(L.hoja);
  var repetido = existentes.filter(function (f) {
    return String(f['Nombre']).trim().toLowerCase() === nombre.toLowerCase() && String(f['ID']) !== String(e.id || '');
  })[0];
  if (repetido) throw new Error('Ya existe «' + nombre + '».');
  var o = { 'Nombre': nombre, 'Activo': e.activo === false ? 'No' : 'Sí' };
  if (lista === 'personas' && e.id && e.activo === false && esQuien_(e.id, quien)) throw new Error('No puedes desactivarte a ti misma/o. Pide a otra persona que lo haga.');
  L.campos.forEach(function (c) { if (c !== 'nombre') o[COLUMNA[c]] = texto_(e[c], 40); });
  if (e.id) {
    var fila = buscarFila_(L.hoja, 'ID', e.id);
    if (!fila) throw new Error('Ese elemento ya no existe.');
    var antes = leerFila_(L.hoja, fila);
    escribirFila_(L.hoja, fila, o);
    if (String(antes['Nombre']) !== nombre) renombrarEnTareas_(lista, e.id, String(antes['Nombre']), nombre);
    registrar_(quien, 'Modificar ' + lista, e.id, nombre);
    return { ok: true, datos: { id: e.id } };
  }
  var max = 0, orden = 0;
  existentes.forEach(function (f) {
    var n = parseInt(String(f['ID']).slice(1), 10); if (n > max) max = n;
    var r = Number(f['Orden']) || 0; if (r > orden) orden = r;
  });
  o['ID'] = L.pref + rellena_(max + 1);
  o['Orden'] = String(orden + 1);
  anadirFila_(L.hoja, o);
  registrar_(quien, 'Nuevo en ' + lista, o['ID'], nombre);
  return { ok: true, datos: { id: o['ID'] } };
}

function borrarElemento_(lista, id, quien) {
  var L = LISTAS[lista];
  if (!L) throw new Error('Lista desconocida.');
  var fila = buscarFila_(L.hoja, 'ID', id);
  if (!fila) throw new Error('Ese elemento ya no existe.');
  var antes = leerFila_(L.hoja, fila);
  if (lista === 'personas' && String(antes['Nombre']) === quien) throw new Error('No puedes borrarte a ti misma/o. Pide a otra persona que lo haga.');
  var usos = filas_('Tareas').filter(function (t) {
    return L.enTareas ? String(t[L.enTareas[0]]) === String(id) : String(t['Responsable']) === String(antes['Nombre']);
  }).length;
  if (usos && L.enTareas) {
    return { ok: false, codigo: 'EN_USO', usos: usos,
             error: '«' + antes['Nombre'] + '» se usa en ' + usos + ' tarea' + (usos === 1 ? '' : 's') + '. Puedes desactivarlo para que no aparezca al crear tareas nuevas.' };
  }
  libro_().getSheetByName(L.hoja).deleteRow(fila);
  registrar_(quien, 'Borrar de ' + lista, id, antes['Nombre']);
  return { ok: true, datos: { id: id } };
}

function renombrarEnTareas_(lista, id, viejo, nuevo) {
  var L = LISTAS[lista];
  var sh = libro_().getSheetByName('Tareas');
  var v = sh.getDataRange().getValues();
  if (!L.enTareas) {
    var cr = v[0].indexOf('Responsable');
    for (var j = 1; j < v.length; j++) if (String(v[j][cr]) === viejo) sh.getRange(j + 1, cr + 1).setValue(nuevo);
    return;
  }
  var ci = v[0].indexOf(L.enTareas[0]), cn = v[0].indexOf(L.enTareas[1]);
  for (var i = 1; i < v.length; i++) if (String(v[i][ci]) === String(id)) sh.getRange(i + 1, cn + 1).setValue(nuevo);
}

function personasActivas_() {
  return filas_('Personas').filter(function (f) { return f['ID'] && f['Nombre'] && f['Activo'] !== 'No'; })
    .sort(function (a, b) { return (Number(a['Orden']) || 0) - (Number(b['Orden']) || 0); })
    .map(function (f) { return String(f['Nombre']); });
}

function esQuien_(id, quien) {
  var f = filas_('Personas').filter(function (x) { return String(x['ID']) === String(id); })[0];
  return f && String(f['Nombre']) === quien;
}

function buscarElemento_(lista, id) {
  if (!id) return null;
  var f = filas_(LISTAS[lista].hoja).filter(function (x) { return String(x['ID']) === String(id); })[0];
  return f ? { id: String(f['ID']), nombre: String(f['Nombre']) } : null;
}

// =====================================================================
// UTILIDADES
// =====================================================================
function libro_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function asegurarCabeceras_(nombre) {
  var sh = libro_().getSheetByName(nombre);
  var cab = HOJAS[nombre];
  var actual = cabecera_(nombre);
  // Las columnas que falten se añaden al final, sin mover las existentes.
  cab.forEach(function (c) {
    if (actual.indexOf(c) < 0) {
      var col = sh.getLastColumn() + 1;
      sh.getRange(1, col).setValue(c).setFontWeight('bold');
      sh.getRange(2, col, sh.getMaxRows() - 1, 1).setNumberFormat('@');
      actual.push(c);
    }
  });
}

function hoja_(nombre) {
  var sh = libro_().getSheetByName(nombre);
  if (!sh) throw new Error('Falta la pestaña «' + nombre + '». Ejecuta configurar().');
  return sh;
}

function filas_(nombre) {
  var v = hoja_(nombre).getDataRange().getValues();
  if (v.length < 2) return [];
  var cab = v[0];
  return v.slice(1).map(function (f) { var o = {}; cab.forEach(function (c, i) { o[c] = f[i]; }); return o; });
}

function cabecera_(nombre) {
  var sh = hoja_(nombre);
  return sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
}

function leerFila_(nombre, fila) {
  var cab = cabecera_(nombre);
  var v = hoja_(nombre).getRange(fila, 1, 1, cab.length).getValues()[0];
  var o = {}; cab.forEach(function (c, i) { o[c] = v[i]; });
  return o;
}

/** Escribe solo las columnas indicadas (por nombre de cabecera), sin tocar las demás. */
function escribirFila_(nombre, fila, o) {
  var sh = hoja_(nombre), cab = cabecera_(nombre);
  var v = sh.getRange(fila, 1, 1, cab.length).getValues()[0];
  cab.forEach(function (c, i) { if (Object.prototype.hasOwnProperty.call(o, c)) v[i] = o[c]; });
  sh.getRange(fila, 1, 1, cab.length).setValues([v]);
}

function anadirFila_(nombre, o) {
  var cab = cabecera_(nombre);
  hoja_(nombre).appendRow(cab.map(function (c) { return o[c] == null ? '' : o[c]; }));
}

function buscarFila_(nombre, columna, valor) {
  if (!valor) return 0;
  var v = hoja_(nombre).getDataRange().getValues();
  var c = v[0].indexOf(columna);
  for (var i = 1; i < v.length; i++) if (String(v[i][c]) === String(valor)) return i + 1;
  return 0;
}

function registrar_(quien, accion, id, detalle) {
  hoja_('Registro').appendRow([ahora_(), quien, accion, id || '', texto_(detalle, 200)]);
}

function nuevoId_() {
  for (var i = 0; i < 50; i++) {
    var id = 'T' + Utilities.formatDate(new Date(), ZONA, 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
    if (!buscarFila_('Tareas', 'ID', id)) return id;
  }
  throw new Error('No se pudo generar un identificador único. Inténtalo de nuevo.');
}

function ahora_() { return Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH:mm'); }
function rellena_(n) { return ('00' + n).slice(-3); }
function texto_(v, max) { return v == null ? '' : String(v).trim().slice(0, max); }

/** Fecha guardada como texto o convertida por Sheets → «yyyy-MM-dd». */
function fecha_(v) {
  if (v instanceof Date) return isNaN(v) ? '' : Utilities.formatDate(v, ZONA, 'yyyy-MM-dd');
  var t = String(v || '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : '';
}
/** Fecha y hora → «yyyy-MM-dd HH:mm». */
function marca_(v) {
  if (v instanceof Date) return isNaN(v) ? '' : Utilities.formatDate(v, ZONA, 'yyyy-MM-dd HH:mm');
  return String(v || '').trim();
}
