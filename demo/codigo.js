/**
 * Tareas y mantenimiento – Puente entre la app y Google Sheets
 * ---------------------------------------------------------------
 * 1. Escribe el PIN común en PIN (obligatorio; sin él la app no deja entrar).
 * 2. Ejecuta una vez la función  configurar  (menú ▶ Ejecutar) y acepta los permisos.
 *    Crea las pestañas Tareas, Espacios, Categorías, Responsables, Proveedores, Fotos, Seguimiento y Registro,
 *    y en Google Drive la carpeta «Tareas – fotos» (con la subcarpeta «Archivo»).
 *    Si ya la habías ejecutado antes, vuelve a hacerlo: añade lo nuevo sin borrar nada.
 *    (Desde la v1.3 pide también permiso para Google Drive: acéptalo.)
 * 3. Implementar ▸ Nueva implementación ▸ Aplicación web
 *      Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier usuario
 * 4. Copia la URL que termina en /exec y pégala en config.js de la app.
 *
 * Para cambiar el código más adelante: Implementar ▸ Gestionar implementaciones ▸ ✏️ ▸
 * Versión nueva. NUNCA «Nueva implementación» (cambiaría la dirección).
 */

// ====== AJUSTES (puedes cambiarlos) ======
var PIN = '';              // PIN común, OBLIGATORIO. Ejemplo: '2468'. Lo escriben todas las personas al entrar.
var HOJA_ID = '';          // Solo si el script NO se creó desde la hoja (Extensiones ▸ Apps Script): el ID de la hoja (lo que va entre /d/ y /edit en su dirección).
var ZONA = 'Europe/Madrid';
var VERSION = '1.4.1';

var ESTADOS = ['Pendiente', 'En curso', 'Esperando', 'Hecha'];
var PRIORIDADES = ['Alta', 'Media', 'Baja'];

// ====== Estructura de datos ======
// Para crecer: añade columnas AL FINAL de una hoja o pestañas nuevas. No cambies los nombres existentes.
var HOJAS = {
  'Tareas': ['ID', 'Título', 'Descripción', 'Categoría ID', 'Categoría', 'Espacio ID', 'Espacio', 'Lugar exacto',
             'Prioridad', 'Urgente', 'Estado', 'Responsable', 'Fecha límite', 'Notas',
             'Creado por', 'Creado el', 'Modificado por', 'Modificado el', 'Hecha el', 'Aviso',
             'Aviso fecha', 'Aviso por', 'Aviso para'],
  'Espacios': ['ID', 'Nombre', 'Código', 'Zona', 'Activo', 'Orden'],
  'Categorías': ['ID', 'Nombre', 'Activo', 'Orden'],
  'Responsables': ['ID', 'Nombre', 'Activo', 'Orden'],
  'Proveedores': ['ID', 'Servicio', 'Empresa', 'Contacto', 'Teléfono 1', 'Teléfono 2', 'Email', 'Dirección', 'Web', 'Notas', 'Activo', 'Orden'],
  'Fotos': ['ID', 'Fecha', 'Usuario', 'Archivo ID', 'Nota', 'Tareas', 'Archivada'],
  'Seguimiento': ['ID', 'Tarea ID', 'Fecha', 'Usuario', 'Tipo', 'Texto', 'Fotos'],
  'Registro': ['Fecha', 'Quién', 'Acción', 'ID', 'Detalle']
};

// Fotos: carpeta de Google Drive (se crea sola al ejecutar configurar) y formatos admitidos.
var CARPETA_FOTOS = 'Tareas – fotos';
var CARPETA_ARCHIVO = 'Archivo';     // aquí se mueven las fotos cuando todas sus tareas están hechas
var FOTO_TIPOS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
var FOTO_MAX = 8000000;              // tamaño máximo en base64 (unos 6 MB; la app las envía reducidas, de ~300 KB)

// Listas editables desde la app. «responsables»: quién puede entrar en la app y a quién se asignan tareas. «enTareas»: columnas de Tareas que guardan el ID y el nombre.
var LISTAS = {
  espacios:     { hoja: 'Espacios',     pref: 'E', campos: ['nombre', 'codigo', 'zona'], enTareas: ['Espacio ID', 'Espacio'] },
  categorias:   { hoja: 'Categorías',   pref: 'C', campos: ['nombre'],                   enTareas: ['Categoría ID', 'Categoría'] },
  responsables: { hoja: 'Responsables', pref: 'P', campos: ['nombre'],                   enTareas: null }
};
var COLUMNA = { nombre: 'Nombre', codigo: 'Código', zona: 'Zona' };

var INICIALES = {
  espacios: ['Entrada y recepción', 'Capilla u oratorio', 'Salas', 'Habitaciones', 'Baños', 'Comedor', 'Cocina',
             'Pasillos y escaleras', 'Cubierta y tejado', 'Sala de calderas e instalaciones', 'Almacén',
             'Exteriores y jardín', 'Otros'],
  categorias: ['Fontanería', 'Electricidad', 'Pintura', 'Carpintería y cerrajería', 'Albañilería',
               'Calefacción y climatización', 'Mobiliario', 'Jardín y exteriores', 'Seguridad',
               'Faltas y compras', 'Otros'],
  responsables: ['Viviane', 'Rafael', 'Gema', 'Carlos']
};

// Agenda de proveedores: campos de la app → columnas de la hoja.
var PROV = { servicio: 'Servicio', empresa: 'Empresa', contacto: 'Contacto', tel1: 'Teléfono 1', tel2: 'Teléfono 2',
             email: 'Email', direccion: 'Dirección', web: 'Web', notas: 'Notas' };
var PROV_MAX = { servicio: 60, empresa: 100, contacto: 80, tel1: 30, tel2: 30, email: 100, direccion: 200, web: 120, notas: 1000 };

// Proveedores de partida (comprobados en noviembre de 2026). Solo se cargan si la pestaña está vacía.
// Orden de cada fila: Servicio, Empresa, Contacto, Teléfono 1, Teléfono 2, Email, Dirección, Web, Notas
var PROVEEDORES_INICIALES = [
  ['Climatización', 'ITC · Ingeniería Térmica y Climática', '', '949 22 77 22', '949 21 86 14', 'info@itcsl.es',
   'Av. de Roanne 88, Pol. Ind. del Henares, 19004 Guadalajara', 'itcsl.es', ''],
  ['Fontanería', 'Instalaciones Fuvisa', '', '949 261 981', '670 061 524', '',
   'C/ Francisco Aritio 156, 19004 Guadalajara', '', ''],
  ['Puertas automáticas', 'Complumatic', '', '656 97 81 21', '656 97 81 06', 'info@complumatic.es',
   'Ctra. M-300 km 25,100, Módulo 8 Nave 6, 28803 Alcalá de Henares', 'complumatic.es',
   'Teléfono 1: servicio técnico y averías. Teléfono 2: comercial y presupuestos.'],
  ['Control de plagas y roedores', 'Anticimex', 'María', '687 147 953', '949 032 113', '',
   'Travesía de Madrid 7, local 1, 19400 Brihuega', 'anticimex.es',
   'Teléfono 1: María. Teléfono 2: delegación de Guadalajara. Atención general: 900 828 001.'],
  ['Alimentos', 'Coaliment (antes CashDiplo) · Ramado', '', '949 214 730', '', '',
   'C/ Cardenal González de Mendoza 5, 19001 Guadalajara', '', ''],
  ['Alimentos', 'Lozano Martínez (carnes)', '', '616 298 921', '949 257 017', 'grupocarnicolozanomartinez@gmail.com',
   'C/ Zaragoza 19, 19005 Guadalajara', '', ''],
  ['Alimentos', 'García Molinero (congelados)', '', '949 200 869', '639 348 091', 'info@garciamolinero.com',
   'C/ Méjico 55, Pol. Ind. El Balconcillo, 19004 Guadalajara', 'garciamolinero.com', ''],
  ['Alimentos', 'Gesfrío (congelados)', '', '949 33 00 11', '', 'gesfrio@gesfrio.com',
   'Ctra. de Tórtola km 4,6, 19290 Fontanar', 'gesfrio.com', ''],
  ['Alimentos', 'Panadería Calvete (pan y bollería de Horche)', '', '949 29 00 93', '', '',
   'C/ Las Fuentes 13, 19140 Horche', 'pandehorche.es', 'Sirve también los fines de semana.'],
  ['Ascensor', 'Orona', '', '949 88 03 85', '914 94 60 50', 'orona.madrid@orona.es',
   'Bulevar de Entrepeñas 14-16, 19005 Guadalajara', 'orona.es', ''],
  ['Menaje de cocina y averías', 'Comercial Plaza', '', '949 22 71 23', '', 'iplaza@comercialplaza.es',
   'C/ Hermanos Fernández Galiano 11D, 19004 Guadalajara', 'comercialplaza.es', ''],
  ['Menaje de cocina y averías', 'Hermanos Cela', '', '914 605 911', '949 210 614', 'hc@hermanoscela.com',
   'C/ Cavanilles 11-13, 28007 Madrid', 'hermanoscela.es',
   'Teléfono 2: su tienda de Guadalajara, Alcarria Hostelería (C/ Livorno 60, Pol. Ind. El Henares).'],
  ['Menaje de cocina y averías', 'Jospe Instalaciones', '', '949 215 431', '630 964 114', '',
   'C/ Felipe Solano Antelo 13, 19002 Guadalajara', '', ''],
  ['Electricidad y conexiones', 'Juper', '', '617 364 686', '949 330 034', '',
   'C/ Sigüenza 13, 19210 Yunquera de Henares', 'jupersl.com', ''],
  ['Electricidad y conexiones', 'Tecnalum', '', '949 25 45 16', '949 25 43 96', '',
   'C/ Juan de Austria 125, Pol. Ind. del Henares, 19004 Guadalajara', 'tecnalum.es', ''],
  ['Informática y dispositivos electrónicos', 'Boreal Comunicaciones', '', '949 200 907', '', 'info@borealcomunicaciones.com',
   'Camino de Alovera, Pol. Ind. La Quinta, parc. 3-6, naves 12-13, 19171 Cabanillas del Campo', 'borealcomunicaciones.com', ''],
  ['Ropa de cocina y mantenimiento', 'Suministros Sumifer', '', '949 22 44 11', '621 223 280', 'sumifer@sumifer.net',
   'C/ Ferial 66, 19002 Guadalajara', 'sumifer.net', 'En la lista original aparecía como «Suministros sumidero».'],
  ['Extintores', 'JOMAR · Alcarreña de Seguridad', '', '949 22 64 12', '659 77 45 85', 'info@jomar-extintores.com',
   'Av. de Cristóbal Colón 102, 19004 Guadalajara', 'jomar-extintores.com', 'Urgencias 24 horas: 608 634 266.']
];

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
  var shp = ss.getSheetByName('Proveedores');
  if (shp.getLastRow() < 2) {
    var cabp = HOJAS['Proveedores'];
    var claves = Object.keys(PROV);
    var filasp = PROVEEDORES_INICIALES.map(function (d, i) {
      var o = { 'ID': 'V' + rellena_(i + 1), 'Activo': 'Sí', 'Orden': String(i + 1) };
      claves.forEach(function (k, j) { o[PROV[k]] = d[j] || ''; });
      return cabp.map(function (c) { return o[c] == null ? '' : o[c]; });
    });
    shp.getRange(2, 1, filasp.length, cabp.length).setValues(filasp);
  }
  var h1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (h1 && ss.getSheets().length > 1 && h1.getLastRow() === 0) ss.deleteSheet(h1);
  var c = prepararCarpetas_();
  Logger.log('Listo: pestañas creadas. Carpeta de fotos: ' + c.raiz.getUrl() +
    (c.compartida ? '' : '  ⚠️ No se pudo compartir con enlace (lo impide la organización): la app mostrará las fotos a través del script, algo más despacio.'));
  return 'ok';
}

// =====================================================================
// ENTRADA DE LA APP
// =====================================================================
function doGet() {
  return json_({ ok: true, datos: { app: 'Tareas', version: VERSION } });
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
    if (pet.accion === 'ping') return { ok: true, datos: { version: VERSION, responsables: responsablesActivos_() } };
    if (!PIN) return { ok: false, error: 'Falta poner el PIN en Code.gs (variable PIN).', codigo: 'SIN_PIN' };
    if (String(pet.pin || '') !== PIN) return { ok: false, error: 'PIN incorrecto.', codigo: 'CLAVE' };
    var quien = texto_(pet.quien, 80);
    if (responsablesActivos_().indexOf(quien) < 0) {
      return { ok: false, error: (quien ? '«' + quien + '» ya no está en la lista de responsables.' : 'Elige quién eres.') + ' Vuelve a entrar.', codigo: 'PERSONA' };
    }
    var d = pet.datos || {};
    switch (pet.accion) {
      case 'inicial': return { ok: true, datos: estado_() };
      case 'guardarTarea': return conBloqueo_(function () { return guardarTarea_(d, quien); });
      case 'cambiarEstado': return conBloqueo_(function () { return cambiarEstado_(d.id, d.estado, quien); });
      case 'borrarTarea': return conBloqueo_(function () { return borrarTarea_(d.id, quien); });
      case 'vistoTarea': return conBloqueo_(function () { return vistoTarea_(d.id, quien); });
      case 'registrarAviso': return conBloqueo_(function () { return registrarAviso_(d, quien); });
      case 'guardarElemento': return conBloqueo_(function () { return guardarElemento_(d.lista, d.elemento || {}, quien); });
      case 'borrarElemento': return conBloqueo_(function () { return borrarElemento_(d.lista, d.id, quien); });
      case 'guardarProveedor': return conBloqueo_(function () { return guardarProveedor_(d.proveedor || {}, quien); });
      case 'borrarProveedor': return conBloqueo_(function () { return borrarProveedor_(d.id, quien); });
      case 'subirFoto': return conBloqueo_(function () { return subirFoto_(d, quien); });
      case 'guardarFoto': return conBloqueo_(function () { return guardarFoto_(d, quien); });
      case 'borrarFoto': return conBloqueo_(function () { return borrarFoto_(d.id, quien); });
      case 'fotosATarea': return conBloqueo_(function () { return fotosATarea_(d.tareaId, d.fotos, quien); });
      case 'anotar': return conBloqueo_(function () { return anotarManual_(d, quien); });
      case 'editarAnotacion': return conBloqueo_(function () { return editarAnotacion_(d, quien); });
      case 'borrarAnotacion': return conBloqueo_(function () { return borrarAnotacion_(d.id, quien); });
      case 'verFoto': return verFoto_(d);
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
function mapearTarea_(t) {
  return {
    id: String(t['ID']), titulo: t['Título'], descripcion: t['Descripción'],
    categoriaId: String(t['Categoría ID'] || ''), categoria: t['Categoría'],
    espacioId: String(t['Espacio ID'] || ''), espacio: t['Espacio'], lugar: t['Lugar exacto'],
    prioridad: t['Prioridad'] || 'Media', urgente: t['Urgente'] === 'Sí', estado: t['Estado'] || 'Pendiente',
    responsable: t['Responsable'], limite: fecha_(t['Fecha límite']), notas: t['Notas'],
    creadoPor: t['Creado por'], creadoEl: marca_(t['Creado el']),
    modificadoPor: t['Modificado por'], modificadoEl: marca_(t['Modificado el']), hechaEl: marca_(t['Hecha el']),
    aviso: String(t['Aviso'] || ''),
    avisoFecha: marca_(t['Aviso fecha']), avisoPor: String(t['Aviso por'] || ''), avisoPara: String(t['Aviso para'] || '')
  };
}

function estado_() {
  var tareas = filas_('Tareas').filter(function (t) { return t['ID']; }).map(mapearTarea_);
  var listas = {};
  Object.keys(LISTAS).forEach(function (k) {
    listas[k] = filas_(LISTAS[k].hoja).filter(function (f) { return f['ID'] && f['Nombre']; }).map(function (f) {
      var o = { id: String(f['ID']), nombre: String(f['Nombre']), activo: f['Activo'] !== 'No', orden: Number(f['Orden']) || 0 };
      LISTAS[k].campos.forEach(function (c) { if (c !== 'nombre') o[c] = f[COLUMNA[c]] == null ? '' : String(f[COLUMNA[c]]); });
      return o;
    }).sort(function (a, b) { return a.orden - b.orden || a.nombre.localeCompare(b.nombre); });
  });
  return {
    tareas: tareas, espacios: listas.espacios, categorias: listas.categorias, responsables: listas.responsables,
    proveedores: proveedores_(), fotos: fotos_(), seguimiento: seguimiento_(),
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
    if (String(antes['Responsable'] || '') !== o['Responsable']) {
      o['Aviso'] = (o['Responsable'] && o['Responsable'] !== quien && estado !== 'Hecha') ? quien : '';
    } else if (estado === 'Hecha') {
      o['Aviso'] = '';
    }
    escribirFila_('Tareas', fila, o);
    var cambios = cambiosTarea_(antes, o);
    if (cambios.length) anotar_(t.id, quien, 'cambio', cambios.join('\n'));
    if ((String(antes['Estado']) === 'Hecha') !== (estado === 'Hecha')) recalcularArchivo_(fotosDeTarea_(t.id));
    registrar_(quien, 'Modificar tarea', t.id, titulo);
    return { ok: true, datos: { id: t.id } };
  }
  var id = nuevoId_();
  o['ID'] = id; o['Creado por'] = quien; o['Creado el'] = ahora;
  o['Hecha el'] = estado === 'Hecha' ? ahora : '';
  o['Aviso'] = (o['Responsable'] && o['Responsable'] !== quien && estado !== 'Hecha') ? quien : '';
  anadirFila_('Tareas', o);
  anotar_(id, quien, 'alta', 'Tarea apuntada' + (o['Responsable'] ? ' · Responsable: ' + o['Responsable'] : ''));
  registrar_(quien, 'Nueva tarea', id, titulo);
  return { ok: true, datos: { id: id } };
}

function cambiarEstado_(id, estado, quien) {
  if (ESTADOS.indexOf(estado) < 0) throw new Error('Estado no válido.');
  var fila = buscarFila_('Tareas', 'ID', id);
  if (!fila) throw new Error('Esa tarea ya no existe.');
  var antes = leerFila_('Tareas', fila);
  var ahora = ahora_();
  var previo = String(antes['Estado'] || 'Pendiente');
  var u = {
    'Estado': estado, 'Modificado por': quien, 'Modificado el': ahora,
    'Hecha el': estado === 'Hecha' ? (antes['Hecha el'] || ahora) : ''
  };
  if (estado === 'Hecha') u['Aviso'] = '';
  escribirFila_('Tareas', fila, u);
  if (previo !== estado) {
    anotar_(id, quien, 'estado', 'Estado: ' + previo + ' → ' + estado);
    if ((previo === 'Hecha') !== (estado === 'Hecha')) recalcularArchivo_(fotosDeTarea_(id));
  }
  registrar_(quien, 'Estado: ' + estado, id, antes['Título']);
  return { ok: true, datos: { id: id } };
}

function vistoTarea_(id, quien) {
  var fila = buscarFila_('Tareas', 'ID', id);
  if (!fila) return { ok: true, datos: { id: id } };
  var t = leerFila_('Tareas', fila);
  if (String(t['Responsable'] || '') === quien && t['Aviso']) {
    escribirFila_('Tareas', fila, { 'Aviso': '' });
  }
  return { ok: true, datos: { id: id } };
}

function registrarAviso_(d, quien) {
  var id = String((d && (d.tareaId || d.id)) || '');
  var fila = buscarFila_('Tareas', 'ID', id);
  if (!fila) throw new Error('Esa tarea ya no existe.');
  var antes = leerFila_('Tareas', fila);
  var resp = String(antes['Responsable'] || '');
  if (!resp) throw new Error('Esta tarea no tiene responsable asignado.');
  var esRecordatorio = String(antes['Aviso para'] || '') === resp;
  var ahora = ahora_();
  escribirFila_('Tareas', fila, { 'Aviso fecha': ahora, 'Aviso por': quien, 'Aviso para': resp });
  var txt = quien + (esRecordatorio ? ' copió un recordatorio para ' : ' copió el aviso para ') + resp;
  anotar_(id, quien, 'aviso', txt);
  registrar_(quien, esRecordatorio ? 'Recordatorio WhatsApp' : 'Aviso WhatsApp', id, resp);
  return { ok: true, datos: { id: id, tarea: mapearTarea_(leerFila_('Tareas', fila)) } };
}

function borrarTarea_(id, quien) {
  var fila = buscarFila_('Tareas', 'ID', id);
  if (!fila) throw new Error('Esa tarea ya no existe.');
  var antes = leerFila_('Tareas', fila);
  libro_().getSheetByName('Tareas').deleteRow(fila);
  // Sus fotos se quedan en el repositorio (sin esta tarea); su seguimiento se borra con ella.
  var fotos = fotosDeTarea_(id);
  fotos.forEach(function (fid) {
    var ff = buscarFila_('Fotos', 'ID', fid);
    if (ff) escribirFila_('Fotos', ff, { 'Tareas': lista_(leerFila_('Fotos', ff)['Tareas']).filter(function (x) { return x !== String(id); }).join(',') });
  });
  recalcularArchivo_(fotos);
  borrarFilasDonde_('Seguimiento', 'Tarea ID', id);
  registrar_(quien, 'Borrar tarea', id, antes['Título']);
  return { ok: true, datos: { id: id } };
}

// =====================================================================
// LISTAS (espacios, categorías, responsables)
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
  if (lista === 'responsables' && e.id && e.activo === false && esQuien_(e.id, quien)) throw new Error('No puedes desactivarte a ti misma/o. Pide a otra persona que lo haga.');
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
  if (lista === 'responsables' && String(antes['Nombre']) === quien) throw new Error('No puedes borrarte a ti misma/o. Pide a otra persona que lo haga.');
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

// =====================================================================
// PROVEEDORES (agenda de teléfonos y datos de contacto)
// =====================================================================
function proveedores_() {
  var sh = libro_().getSheetByName('Proveedores');
  if (!sh) return []; // aún no se ha vuelto a ejecutar configurar() tras actualizar
  return filas_('Proveedores').filter(function (f) { return f['ID'] && (f['Empresa'] || f['Servicio']); }).map(function (f) {
    var o = { id: String(f['ID']), activo: f['Activo'] !== 'No', orden: Number(f['Orden']) || 0 };
    Object.keys(PROV).forEach(function (k) { o[k] = f[PROV[k]] == null ? '' : String(f[PROV[k]]); });
    return o;
  }).sort(function (a, b) { return a.orden - b.orden || a.empresa.localeCompare(b.empresa); });
}

function guardarProveedor_(p, quien) {
  hoja_('Proveedores');
  var o = {};
  Object.keys(PROV).forEach(function (k) { o[PROV[k]] = texto_(p[k], PROV_MAX[k]); });
  if (!o['Empresa']) throw new Error('Falta el nombre de la empresa o persona.');
  if (!o['Servicio']) throw new Error('Falta el servicio (ej.: Fontanería).');
  if (o['Email'] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o['Email'])) throw new Error('El correo no parece válido.');
  o['Activo'] = p.activo === false ? 'No' : 'Sí';
  if (p.id) {
    var fila = buscarFila_('Proveedores', 'ID', p.id);
    if (!fila) throw new Error('Ese proveedor ya no existe (¿lo borró otra persona?).');
    escribirFila_('Proveedores', fila, o);
    registrar_(quien, 'Modificar proveedor', p.id, o['Empresa']);
    return { ok: true, datos: { id: p.id } };
  }
  var max = 0, orden = 0;
  filas_('Proveedores').forEach(function (f) {
    var n = parseInt(String(f['ID']).slice(1), 10); if (n > max) max = n;
    var r = Number(f['Orden']) || 0; if (r > orden) orden = r;
  });
  o['ID'] = 'V' + rellena_(max + 1);
  o['Orden'] = String(orden + 1);
  anadirFila_('Proveedores', o);
  registrar_(quien, 'Nuevo proveedor', o['ID'], o['Empresa']);
  return { ok: true, datos: { id: o['ID'] } };
}

function borrarProveedor_(id, quien) {
  var fila = buscarFila_('Proveedores', 'ID', id);
  if (!fila) throw new Error('Ese proveedor ya no existe.');
  var antes = leerFila_('Proveedores', fila);
  libro_().getSheetByName('Proveedores').deleteRow(fila);
  registrar_(quien, 'Borrar proveedor', id, antes['Empresa']);
  return { ok: true, datos: { id: id } };
}

// =====================================================================
// FOTOS (repositorio en Google Drive) y SEGUIMIENTO de cada tarea
// =====================================================================
/** Crea (si faltan) la carpeta de fotos y su subcarpeta «Archivo», y comparte la carpeta con enlace. */
function prepararCarpetas_() {
  var props = PropertiesService.getScriptProperties();
  var raiz = carpetaPorId_(props.getProperty('CARPETA_FOTOS'));
  if (!raiz) { raiz = DriveApp.createFolder(CARPETA_FOTOS); props.setProperty('CARPETA_FOTOS', raiz.getId()); }
  var arch = carpetaPorId_(props.getProperty('CARPETA_ARCHIVO'));
  if (!arch) { arch = raiz.createFolder(CARPETA_ARCHIVO); props.setProperty('CARPETA_ARCHIVO', arch.getId()); }
  var compartida = true;
  try { raiz.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { compartida = false; }
  return { raiz: raiz, archivo: arch, compartida: compartida };
}

function carpetaPorId_(id) {
  if (!id) return null;
  try { var f = DriveApp.getFolderById(id); return f.isTrashed() ? null : f; } catch (e) { return null; }
}

function carpetas_() {
  var props = PropertiesService.getScriptProperties();
  var raiz = carpetaPorId_(props.getProperty('CARPETA_FOTOS')), arch = carpetaPorId_(props.getProperty('CARPETA_ARCHIVO'));
  if (!raiz || !arch) throw new Error('Falta la carpeta de fotos en Drive. Ejecuta configurar() en Apps Script.');
  return { raiz: raiz, archivo: arch };
}

function fotos_() {
  if (!libro_().getSheetByName('Fotos')) return [];
  return filas_('Fotos').filter(function (f) { return f['ID'] && f['Archivo ID']; }).map(function (f) {
    return { id: String(f['ID']), fecha: marca_(f['Fecha']), usuario: String(f['Usuario'] || ''), archivo: String(f['Archivo ID']),
             nota: String(f['Nota'] || ''), tareas: lista_(f['Tareas']), archivada: f['Archivada'] === 'Sí' };
  }).sort(function (a, b) { return b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id); });
}

function seguimiento_() {
  if (!libro_().getSheetByName('Seguimiento')) return [];
  return filas_('Seguimiento').filter(function (f) { return f['ID'] && f['Tarea ID']; }).map(function (f) {
    return { id: String(f['ID']), tareaId: String(f['Tarea ID']), fecha: marca_(f['Fecha']), usuario: String(f['Usuario'] || ''),
             tipo: String(f['Tipo'] || 'nota'), texto: String(f['Texto'] || ''), fotos: lista_(f['Fotos']) };
  });
}

/** Nueva foto: se guarda en Drive y en la pestaña Fotos. Si llega con tareaId, queda asignada y se anota en su seguimiento. */
function subirFoto_(d, quien) {
  var tipo = String(d.tipo || 'image/jpeg');
  if (!FOTO_TIPOS[tipo]) throw new Error('Formato de imagen no admitido (usa JPG o PNG).');
  var b64 = String(d.base64 || '').replace(/^data:[^,]*,/, '');
  if (!b64) throw new Error('No ha llegado ninguna imagen.');
  if (b64.length > FOTO_MAX) throw new Error('La imagen es demasiado grande.');
  var tareaId = d.tareaId ? String(d.tareaId) : '';
  var tareas = tareaId ? tareasPorId_() : {};
  if (tareaId && !tareas[tareaId]) throw new Error('Esa tarea ya no existe.');
  var c = carpetas_();
  var id = nuevoIdEn_('Fotos', 'F');
  var archivo = c.raiz.createFile(Utilities.newBlob(Utilities.base64Decode(b64), tipo, id + '.' + FOTO_TIPOS[tipo]));
  try { archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  anadirFila_('Fotos', { 'ID': id, 'Fecha': ahora_(), 'Usuario': quien, 'Archivo ID': archivo.getId(),
                         'Nota': texto_(d.nota, 300), 'Tareas': tareaId, 'Archivada': '' });
  if (tareaId) {
    anotar_(tareaId, quien, 'foto', 'Foto añadida', [id]);
    recalcularArchivo_([id]);
  }
  registrar_(quien, 'Nueva foto', id, tareaId ? tareas[tareaId].titulo : 'sin asignar');
  return { ok: true, datos: { id: id } };
}

/** Cambia la nota y/o las tareas de una foto (una foto puede estar en varias tareas). */
function guardarFoto_(d, quien) {
  var fila = buscarFila_('Fotos', 'ID', d.id);
  if (!fila) throw new Error('Esa foto ya no existe (¿la borró otra persona?).');
  var antes = leerFila_('Fotos', fila);
  var o = {};
  if (d.nota != null) o['Nota'] = texto_(d.nota, 300);
  if (d.tareas) {
    var tareas = tareasPorId_(), nuevas = [];
    [].concat(d.tareas).forEach(function (x) { x = String(x); if (tareas[x] && nuevas.indexOf(x) < 0) nuevas.push(x); });
    var viejas = lista_(antes['Tareas']);
    o['Tareas'] = nuevas.join(',');
    nuevas.filter(function (x) { return viejas.indexOf(x) < 0; }).forEach(function (x) { anotar_(x, quien, 'foto', 'Foto añadida', [String(d.id)]); });
    viejas.filter(function (x) { return nuevas.indexOf(x) < 0 && tareas[x]; }).forEach(function (x) { anotar_(x, quien, 'foto', 'Foto quitada de la tarea'); });
  }
  escribirFila_('Fotos', fila, o);
  recalcularArchivo_([String(d.id)]);
  registrar_(quien, 'Modificar foto', d.id, o['Tareas'] != null ? (o['Tareas'] || 'sin asignar') : 'nota');
  return { ok: true, datos: { id: d.id } };
}

/** Añade varias fotos del repositorio a una tarea, con una sola entrada en su seguimiento. */
function fotosATarea_(tareaId, ids, quien, sinAnotar) {
  var tareas = tareasPorId_();
  if (!tareas[tareaId]) throw new Error('Esa tarea ya no existe.');
  var anadidas = [];
  [].concat(ids || []).forEach(function (fid) {
    var fila = buscarFila_('Fotos', 'ID', fid);
    if (!fila) return;
    var ts = lista_(leerFila_('Fotos', fila)['Tareas']);
    if (ts.indexOf(String(tareaId)) < 0) { ts.push(String(tareaId)); escribirFila_('Fotos', fila, { 'Tareas': ts.join(',') }); }
    anadidas.push(String(fid));
  });
  if (anadidas.length && !sinAnotar) anotar_(tareaId, quien, 'foto', anadidas.length === 1 ? 'Foto añadida' : anadidas.length + ' fotos añadidas', anadidas);
  recalcularArchivo_(anadidas);
  if (!sinAnotar) registrar_(quien, 'Fotos a tarea', tareaId, anadidas.join(','));
  return { ok: true, datos: { id: tareaId, fotos: anadidas } };
}

function borrarFoto_(id, quien) {
  var fila = buscarFila_('Fotos', 'ID', id);
  if (!fila) throw new Error('Esa foto ya no existe.');
  var antes = leerFila_('Fotos', fila);
  try { DriveApp.getFileById(String(antes['Archivo ID'])).setTrashed(true); } catch (e) { /* ya no estaba en Drive */ }
  libro_().getSheetByName('Fotos').deleteRow(fila);
  var tareas = tareasPorId_();
  lista_(antes['Tareas']).forEach(function (x) { if (tareas[x]) anotar_(x, quien, 'foto', 'Foto borrada del repositorio'); });
  registrar_(quien, 'Borrar foto', id, String(antes['Archivo ID']));
  return { ok: true, datos: { id: id } };
}

/** La imagen a través del script (por si Drive no deja verla con el enlace). */
function verFoto_(d) {
  var fila = buscarFila_('Fotos', 'ID', d.id);
  if (!fila) return { ok: false, error: 'Esa foto ya no existe.' };
  var archivo = DriveApp.getFileById(String(leerFila_('Fotos', fila)['Archivo ID']));
  var blob = null;
  if (!d.grande) { try { blob = archivo.getThumbnail(); } catch (e) { blob = null; } }
  blob = blob || archivo.getBlob();
  return { ok: true, datos: { data: 'data:' + (blob.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(blob.getBytes()) } };
}

/** Entrada escrita a mano en el seguimiento (texto y/o fotos del repositorio). */
function anotarManual_(d, quien) {
  var tareaId = String(d.tareaId || '');
  if (!tareasPorId_()[tareaId]) throw new Error('Esa tarea ya no existe.');
  var texto = texto_(d.texto, 2000);
  var fotos = [].concat(d.fotos || []).map(String).filter(function (f) { return buscarFila_('Fotos', 'ID', f); });
  if (!texto && !fotos.length) throw new Error('Escribe algo o añade una foto.');
  if (fotos.length) fotosATarea_(tareaId, fotos, quien, true);
  var id = anotar_(tareaId, quien, 'nota', texto, fotos);
  registrar_(quien, 'Seguimiento', tareaId, texto);
  return { ok: true, datos: { id: id } };
}

function editarAnotacion_(d, quien) {
  var fila = buscarFila_('Seguimiento', 'ID', d.id);
  if (!fila) throw new Error('Esa entrada ya no existe.');
  var antes = leerFila_('Seguimiento', fila);
  if (String(antes['Tipo']) !== 'nota') throw new Error('Las entradas automáticas no se pueden editar (sí borrar).');
  var texto = texto_(d.texto, 2000);
  if (!texto && !lista_(antes['Fotos']).length) throw new Error('Escribe algo o borra la entrada.');
  escribirFila_('Seguimiento', fila, { 'Texto': texto });
  registrar_(quien, 'Editar seguimiento', antes['Tarea ID'], texto);
  return { ok: true, datos: { id: d.id } };
}

function borrarAnotacion_(id, quien) {
  var fila = buscarFila_('Seguimiento', 'ID', id);
  if (!fila) throw new Error('Esa entrada ya no existe.');
  var antes = leerFila_('Seguimiento', fila);
  libro_().getSheetByName('Seguimiento').deleteRow(fila);
  registrar_(quien, 'Borrar seguimiento', antes['Tarea ID'], antes['Texto']);
  return { ok: true, datos: { id: id } };
}

/** Añade una entrada al seguimiento de una tarea. tipo: nota (a mano) · alta · estado · cambio · foto (automáticas). */
function anotar_(tareaId, quien, tipo, texto, fotos) {
  if (!libro_().getSheetByName('Seguimiento')) return '';
  var id = nuevoIdEn_('Seguimiento', 'S');
  anadirFila_('Seguimiento', { 'ID': id, 'Tarea ID': String(tareaId), 'Fecha': ahora_(), 'Usuario': quien, 'Tipo': tipo,
                               'Texto': texto_(texto, 2000), 'Fotos': (fotos || []).join(',') });
  return id;
}

/** Cambios que se anotan solos al editar una tarea. */
function cambiosTarea_(a, o) {
  var c = [], v = function (x) { return String(x == null ? '' : x); };
  if (v(a['Estado'] || 'Pendiente') !== v(o['Estado'])) c.push('Estado: ' + v(a['Estado'] || 'Pendiente') + ' → ' + o['Estado']);
  if (v(a['Prioridad'] || 'Media') !== v(o['Prioridad'])) c.push('Prioridad: ' + v(a['Prioridad'] || 'Media') + ' → ' + o['Prioridad']);
  if ((a['Urgente'] === 'Sí') !== (o['Urgente'] === 'Sí')) c.push(o['Urgente'] === 'Sí' ? 'Marcada como urgente' : 'Ya no es urgente');
  if (v(a['Responsable']) !== v(o['Responsable'])) c.push('Responsable: ' + (v(a['Responsable']) || 'sin asignar') + ' → ' + (o['Responsable'] || 'sin asignar'));
  return c;
}

/** Archivo: una foto se mueve a «Archivo» cuando TODAS sus tareas están hechas, y vuelve si alguna se reabre. */
function recalcularArchivo_(ids) {
  if (!ids || !ids.length || !libro_().getSheetByName('Fotos')) return;
  var tareas = tareasPorId_(), c;
  try { c = carpetas_(); } catch (e) { c = null; }
  ids.forEach(function (fid) {
    var fila = buscarFila_('Fotos', 'ID', fid);
    if (!fila) return;
    var f = leerFila_('Fotos', fila);
    var ts = lista_(f['Tareas']).filter(function (x) { return tareas[x]; });
    var archivar = ts.length > 0 && ts.every(function (x) { return tareas[x].estado === 'Hecha'; });
    if (archivar === (f['Archivada'] === 'Sí')) return;
    if (c) { try { DriveApp.getFileById(String(f['Archivo ID'])).moveTo(archivar ? c.archivo : c.raiz); } catch (e) { /* se marca igualmente */ } }
    escribirFila_('Fotos', fila, { 'Archivada': archivar ? 'Sí' : '' });
  });
}

function fotosDeTarea_(tareaId) {
  if (!libro_().getSheetByName('Fotos')) return [];
  return filas_('Fotos').filter(function (f) { return f['ID'] && lista_(f['Tareas']).indexOf(String(tareaId)) >= 0; })
    .map(function (f) { return String(f['ID']); });
}

function tareasPorId_() {
  var m = {};
  filas_('Tareas').forEach(function (t) { if (t['ID']) m[String(t['ID'])] = { titulo: String(t['Título']), estado: String(t['Estado'] || 'Pendiente') }; });
  return m;
}

function borrarFilasDonde_(nombre, columna, valor) {
  var sh = libro_().getSheetByName(nombre);
  if (!sh) return;
  var v = sh.getDataRange().getValues(), c = v[0].indexOf(columna);
  for (var i = v.length - 1; i >= 1; i--) if (String(v[i][c]) === String(valor)) sh.deleteRow(i + 1);
}

function lista_(s) { return String(s == null ? '' : s).split(',').map(function (x) { return x.trim(); }).filter(Boolean); }

var CONTADOR_ = 0;
function nuevoIdEn_(hoja, pref) {
  for (var i = 0; i < 50; i++) {
    CONTADOR_ = (CONTADOR_ + 1) % 100;
    var id = pref + Utilities.formatDate(new Date(), ZONA, 'yyMMddHHmmss') + ('0' + CONTADOR_).slice(-2) + Math.floor(Math.random() * 10);
    if (!buscarFila_(hoja, 'ID', id)) return id;
  }
  throw new Error('No se pudo generar un identificador único. Inténtalo de nuevo.');
}

function renombrarEnTareas_(lista, id, viejo, nuevo) {
  var L = LISTAS[lista];
  var sh = libro_().getSheetByName('Tareas');
  var v = sh.getDataRange().getValues();
  if (!L.enTareas) {
    var cr = v[0].indexOf('Responsable'), ca = v[0].indexOf('Aviso'), cpor = v[0].indexOf('Aviso por'), cpara = v[0].indexOf('Aviso para');
    for (var j = 1; j < v.length; j++) {
      if (String(v[j][cr]) === viejo) sh.getRange(j + 1, cr + 1).setValue(nuevo);
      if (ca >= 0 && String(v[j][ca]) === viejo) sh.getRange(j + 1, ca + 1).setValue(nuevo);
      if (cpor >= 0 && String(v[j][cpor]) === viejo) sh.getRange(j + 1, cpor + 1).setValue(nuevo);
      if (cpara >= 0 && String(v[j][cpara]) === viejo) sh.getRange(j + 1, cpara + 1).setValue(nuevo);
    }
    return;
  }
  var ci = v[0].indexOf(L.enTareas[0]), cn = v[0].indexOf(L.enTareas[1]);
  for (var i = 1; i < v.length; i++) if (String(v[i][ci]) === String(id)) sh.getRange(i + 1, cn + 1).setValue(nuevo);
}

function responsablesActivos_() {
  return filas_('Responsables').filter(function (f) { return f['ID'] && f['Nombre'] && f['Activo'] !== 'No'; })
    .sort(function (a, b) { return (Number(a['Orden']) || 0) - (Number(b['Orden']) || 0); })
    .map(function (f) { return String(f['Nombre']); });
}

function esQuien_(id, quien) {
  var f = filas_('Responsables').filter(function (x) { return String(x['ID']) === String(id); })[0];
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
function libro_() { return HOJA_ID ? SpreadsheetApp.openById(HOJA_ID) : SpreadsheetApp.getActiveSpreadsheet(); }

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
  asegurarCabeceras_(nombre);
  var sh = hoja_(nombre), cab = cabecera_(nombre);
  var v = sh.getRange(fila, 1, 1, cab.length).getValues()[0];
  cab.forEach(function (c, i) { if (Object.prototype.hasOwnProperty.call(o, c)) v[i] = o[c]; });
  sh.getRange(fila, 1, 1, cab.length).setValues([v]);
}

function anadirFila_(nombre, o) {
  asegurarCabeceras_(nombre);
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
