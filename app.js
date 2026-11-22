/* Tareas y mantenimiento – tareas de la casa, fotos, seguimiento y agenda de proveedores (v1.3) */
(function () {
  'use strict';
  var C = window.CONFIG || {};
  var DEMO = !C.API_URL;
  var VERSION = '1.3.0';
  var S = { pin: null, quien: null, datos: null, sinConexion: false,
            f: { estado: 'abiertas', cat: '', esp: '', texto: '', soloUrg: false }, textoHechas: '',
            prov: { texto: '', inactivos: false, abiertos: {} },
            fotosF: 'sin', seg: {}, borrador: {}, driveNoVa: false };
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var vista = $('#vista');
  var ESTADOS = ['Pendiente', 'En curso', 'Esperando', 'Hecha'];
  var PRIORIDADES = ['Alta', 'Media', 'Baja'];
  var LISTAS = {
    espacios: { titulo: 'Espacios', uno: 'espacio', extra: true },
    categorias: { titulo: 'Categorías', uno: 'categoría' },
    responsables: { titulo: 'Responsables', uno: 'responsable' }
  };
  var ICO = {
    editar: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
    borrar: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    buscar: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    tel: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    correo: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    mapa: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    web: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    camara: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    galeria: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>'
  };

  // ---------------- Almacenamiento local (con protección) ----------------
  function lsGet(k) { try { return JSON.parse(localStorage.getItem('nec:' + k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem('nec:' + k, JSON.stringify(v)); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem('nec:' + k); } catch (e) {} }

  // ---------------- Utilidades ----------------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function aTexto(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hoyTxt() { return aTexto(new Date()); }
  function sumaDias(s, n) { var p = s.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]); d.setDate(d.getDate() + n); return aTexto(d); }
  function legible(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2}))?/); return m ? m[3] + '/' + m[2] + '/' + m[1] + (m[4] ? ' ' + m[4] : '') : (s || ''); }
  function corta(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] : ''; }
  function sinAcentos(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function toast(msg, error) {
    var t = $('#toast');
    t.textContent = msg; t.className = 'toast' + (error ? ' error' : ''); t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, error ? 5500 : 2800);
  }
  function cargando(on) { $('#cargando').hidden = !on; }
  function cerrarModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
  function modal(html, alPulsar) {
    var m = $('#modal');
    m.innerHTML = '<div class="caja">' + html + '</div>';
    m.hidden = false;
    m.onclick = function (e) {
      if (e.target === m) { cerrarModal(); return; }
      if (alPulsar) alPulsar(e, cerrarModal);
    };
  }
  function confirmar(texto, boton, peligro) {
    return new Promise(function (ok) {
      modal('<p>' + texto + '</p><div class="fila-btns"><button class="btn borde" data-r="0">Volver</button>' +
        '<button class="btn ' + (peligro ? 'peligro' : '') + '" data-r="1">' + esc(boton) + '</button></div>',
        function (e, cerrar) { var b = e.target.closest('[data-r]'); if (b) { cerrar(); ok(b.dataset.r === '1'); } });
      $('#modal').addEventListener('click', function f(e) { if (e.target === this) { this.removeEventListener('click', f); ok(false); } });
    });
  }

  // ---------------- Comunicación con Google (o demostración) ----------------
  var demoListo = null;
  var PIN_DEMO = '1234';
  function cargarScript(src) {
    return new Promise(function (ok, ko) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { ko(new Error('No se encuentra el archivo ' + src + '. ¿Se subió la carpeta «demo» a GitHub?')); }; document.head.appendChild(s); });
  }
  function prepararDemo() {
    if (!demoListo) {
      demoListo = cargarScript('demo/gas-mock.js').then(function () { return cargarScript('demo/codigo.js'); }).then(function () {
        window.PIN = PIN_DEMO;
        window.configurar(); // crea las pestañas que falten (no borra datos)
        if (!lsGet('demoIniciada')) {
          window.__GAS_RESET__ && window.__GAS_RESET__();
          window.configurar();
          var p = function (t) { return window.atender({ pin: PIN_DEMO, quien: 'Gema', accion: 'guardarTarea', datos: { tarea: t } }); };
          var r;
          p({ titulo: 'Grifo del lavabo gotea', espacioId: 'E005', lugar: 'Baño planta baja, junto al comedor', categoriaId: 'C001', prioridad: 'Alta', urgente: true, limite: sumaDias(hoyTxt(), 2), descripcion: 'Gotea aunque se cierre del todo. Puede ser la zapata.' });
          p({ titulo: 'Fluorescente fundido', espacioId: 'E008', lugar: 'Pasillo de la primera planta', categoriaId: 'C002', prioridad: 'Media' });
          p({ titulo: 'Pintar la pared con humedad', espacioId: 'E003', lugar: 'Sala grande', categoriaId: 'C003', prioridad: 'Baja', estado: 'Esperando', notas: 'Esperando a que seque antes de pintar.' });
          p({ titulo: 'Comprar bombillas y pilas', espacioId: 'E011', categoriaId: 'C010', prioridad: 'Media', limite: sumaDias(hoyTxt(), -1) });
          p({ titulo: 'Revisar extintores', espacioId: 'E001', categoriaId: 'C009', prioridad: 'Alta', estado: 'En curso', responsable: 'Carlos', limite: sumaDias(hoyTxt(), 10) });
          r = p({ titulo: 'Engrasar la puerta de la capilla', espacioId: 'E002', categoriaId: 'C004', prioridad: 'Baja' });
          if (r && r.ok) window.atender({ pin: PIN_DEMO, quien: 'Gema', accion: 'cambiarEstado', datos: { id: r.datos.id, estado: 'Hecha' } });
          lsSet('demoIniciada', true);
        }
      });
    }
    return demoListo;
  }

  function api(accion, datos) {
    var pet = { pin: S.pin || '', quien: S.quien || '', accion: accion, datos: datos || {} };
    var p = DEMO
      ? prepararDemo().then(function () { return new Promise(function (ok) { setTimeout(function () { ok(window.atender(JSON.parse(JSON.stringify(pet)))); }, 150); }); })
      : fetch(C.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(pet), redirect: 'follow' })
          .then(function (r) { if (!r.ok) throw new Error('El servidor respondió ' + r.status); return r.json(); })
          .catch(function (e) { if (e instanceof TypeError) { var x = new Error(navigator.onLine === false ? 'Sin conexión. Revisa la cobertura e inténtalo de nuevo.' : 'No se pudo conectar con Google. Revisa que API_URL termine en /exec y que el script esté implementado para «Cualquier usuario».'); x.red = true; throw x; } if (e instanceof SyntaxError) throw new Error('Google no devolvió datos válidos. Revisa la implementación del script.'); throw e; });
    return p.then(function (r) {
      if (!r || !r.ok) { var err = new Error((r && r.error) || 'Error desconocido'); err.codigo = r && r.codigo; throw err; }
      if (r.datos && r.datos.estado) fijarDatos(r.datos.estado);
      if (accion === 'inicial') fijarDatos(r.datos);
      return r.datos;
    });
  }

  function fijarDatos(d) { S.datos = d; S.sinConexion = false; lsSet('cache', { datos: d, cuando: Date.now() }); avisoConexion(); }

  function avisoConexion() {
    var a = $('#aviso');
    if (S.sinConexion) {
      var c = lsGet('cache');
      a.className = 'aviso';
      a.textContent = 'Sin conexión: datos del ' + (c ? new Date(c.cuando).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—') + '. No se pueden guardar cambios.';
      a.hidden = false;
    } else if (DEMO) {
      a.className = 'aviso demo'; a.textContent = 'MODO DEMOSTRACIÓN · los datos solo se guardan en este dispositivo'; a.hidden = false;
    } else a.hidden = true;
  }

  function editando() { var v = ruta().vista; return v === 'nueva' || v === 'editar'; }

  /** Recarga datos. Si se está escribiendo una tarea NO se redibuja (para no perder lo escrito). */
  function recargar(silencioso) {
    if (!silencioso) cargando(true);
    return api('inicial').then(function () { if (!editando() && $('#modal').hidden) pintar(); })
      .catch(function (e) {
        if (e.codigo === 'CLAVE') return salir('El PIN ha cambiado. Vuelve a entrar.');
        if (e.codigo === 'PERSONA' || e.codigo === 'SIN_PIN') return salir(e.message);
        var c = lsGet('cache');
        if (e.red && c) { S.datos = c.datos; S.sinConexion = true; avisoConexion(); if (!editando()) pintar(); }
        else if (!silencioso) toast(e.message, true);
      })
      .then(function () { cargando(false); });
  }
  function guardar(accion, datos, msg) {
    if (S.sinConexion) { toast('Sin conexión: no se pueden guardar cambios ahora.', true); return Promise.reject(new Error('sin conexión')); }
    cargando(true);
    return api(accion, datos).then(function (d) { if (msg) toast(msg); return d; })
      .catch(function (e) {
        if (e.codigo === 'CLAVE' || e.codigo === 'PERSONA') { cerrarModal(); salir(e.codigo === 'CLAVE' ? 'El PIN ha cambiado. Vuelve a entrar.' : e.message); throw e; }
        if (e.codigo !== 'EN_USO') toast(e.message, true); throw e;
      })
      .then(function (d) { cargando(false); return d; }, function (e) { cargando(false); throw e; });
  }

  // ---------------- Datos derivados ----------------
  function tareas() { return (S.datos && S.datos.tareas) || []; }
  function tarea(id) { return tareas().filter(function (t) { return t.id === id; })[0]; }
  function lista(k) { return (S.datos && S.datos[k]) || []; }
  function elemento(k, id) { return lista(k).filter(function (e) { return e.id === id; })[0]; }
  var RANGO = { Alta: 0, Media: 1, Baja: 2 };
  function ordenar(a) {
    return a.slice().sort(function (x, y) {
      return (y.urgente - x.urgente) || ((RANGO[x.prioridad] || 1) - (RANGO[y.prioridad] || 1)) ||
        (x.limite || '9999').localeCompare(y.limite || '9999') || String(x.creadoEl).localeCompare(String(y.creadoEl));
    });
  }
  function claseEstado(e) { return { 'Pendiente': 'pendiente', 'En curso': 'encurso', 'Esperando': 'esperando', 'Hecha': 'hecha' }[e] || 'pendiente'; }
  function clasePrio(t) { return t.estado === 'Hecha' ? 'hecha' : t.urgente ? 'urgente' : (t.prioridad || 'Media').toLowerCase(); }
  function vencida(t) { return t.limite && t.estado !== 'Hecha' && t.limite < hoyTxt(); }
  function nombreEspacio(t) { var e = elemento('espacios', t.espacioId); return e ? e.nombre : (t.espacio || ''); }
  function nombreCategoria(t) { var e = elemento('categorias', t.categoriaId); return e ? e.nombre : (t.categoria || ''); }
  function codigoEspacio(t) { var e = elemento('espacios', t.espacioId); return e && e.codigo ? e.codigo : ''; }
  function textoLugar(t) {
    var cod = codigoEspacio(t), esp = nombreEspacio(t);
    return [cod ? cod + ' · ' + esp : esp, t.lugar].filter(Boolean).join(' — ');
  }

  // ---------------- Navegación ----------------
  var TITULOS = { lista: 'Pendientes', nueva: 'Nueva necesidad', editar: 'Editar', tarea: 'Necesidad', hechas: 'Hechas', fotos: 'Fotos', proveedores: 'Proveedores', ajustes: 'Ajustes' };
  function ruta() {
    var h = location.hash.replace(/^#\/?/, '');
    var seg = h.split('?')[0].split('/');
    return { vista: seg[0] || 'lista', id: seg[1] ? decodeURIComponent(seg[1]) : null };
  }
  function ir(h) { if (location.hash === '#/' + h) pintar(); else location.hash = '/' + h; }
  var historial = 0;
  window.addEventListener('hashchange', function () { historial++; });
  function volver() { if (historial > 0 && history.length > 1) history.back(); else ir('lista'); }
  function botonVolver() { return '<button class="volver" id="bVolver"><span>‹</span> Volver</button>'; }
  function enlazarVolver() { var b = $('#bVolver'); if (b) b.onclick = volver; }

  function pintar() {
    if (!S.quien) return pintarLogin();
    if (!S.datos) return;
    var r = ruta();
    $('#menu').hidden = false; $('#btnRecargar').hidden = false;
    $('#tituloVista').textContent = TITULOS[r.vista] || '';
    document.body.setAttribute('data-vista', r.vista);
    $$('.menu button').forEach(function (b) {
      b.classList.toggle('activo', b.dataset.ir === r.vista || (b.dataset.ir === 'lista' && r.vista === 'tarea'));
    });
    // Si se vuelve a pintar la misma pantalla (tras guardar o actualizar), se conserva la posición.
    var misma = S.rutaPintada === location.hash, sc = vista.scrollTop;
    S.rutaPintada = location.hash;
    switch (r.vista) {
      case 'tarea': pintarDetalle(r.id); break;
      case 'nueva': pintarFormulario(null); break;
      case 'editar': pintarFormulario(r.id); break;
      case 'hechas': pintarHechas(); break;
      case 'fotos': pintarFotos(); break;
      case 'proveedores': pintarProveedores(); break;
      case 'ajustes': pintarAjustes(); break;
      default: pintarLista();
    }
    vista.scrollTop = misma ? sc : 0;
  }

  // ---------------- Acceso ----------------
  function pintarLogin(msg) {
    document.body.setAttribute('data-vista', 'login');
    $('#menu').hidden = true; $('#btnRecargar').hidden = true;
    $('#tituloVista').textContent = 'Acceso';
    var elegido = lsGet('quien') || '';
    vista.innerHTML =
      '<div class="login"><img class="logo" src="icons/icon-192.png" alt="">' +
      '<h1>' + esc(C.NOMBRE_CASA || 'Casa') + '</h1><p class="sub">' + esc(C.SUBTITULO || 'Tareas y mantenimiento') + '</p>' +
      '<div class="tarjeta"><label class="campo"><span>¿Quién eres?</span><select class="entrada" id="lQuien"><option value="">Cargando…</option></select></label>' +
      '<label class="campo"><span>PIN de la casa</span><input class="entrada" id="lPin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="' + (DEMO ? 'En demostración: ' + PIN_DEMO : 'PIN común') + '"></label>' +
      '<p class="error-txt" id="lError">' + esc(msg || '') + '</p>' +
      '<button class="btn ancho" id="lEntrar" style="margin-top:14px">Entrar</button></div></div>';
    function rellenar(nombres) {
      var sel = $('#lQuien'); if (!sel) return;
      if (elegido && nombres.indexOf(elegido) < 0) elegido = '';
      sel.innerHTML = '<option value="">— Elige tu nombre —</option>' + nombres.map(function (n) {
        return '<option' + (n === elegido ? ' selected' : '') + '>' + esc(n) + '</option>';
      }).join('');
      if (!nombres.length) $('#lError').textContent = 'No hay responsables en la lista. Añádelos en la pestaña «Responsables» de la hoja de Google.';
    }
    // La lista de responsables la da el puente (sin PIN). Si no hay conexión, la última conocida.
    api('ping').then(function (d) { lsSet('responsables', d.responsables || []); rellenar(d.responsables || []); })
      .catch(function (e) {
        var guardadas = lsGet('responsables') || [];
        rellenar(guardadas);
        if (!guardadas.length && $('#lError')) $('#lError').textContent = e.message;
      });
    function entrar() {
      var nombre = $('#lQuien').value, pin = $('#lPin').value.trim();
      if (!nombre) return ($('#lError').textContent = 'Elige tu nombre.');
      if (!pin) return ($('#lError').textContent = 'Escribe el PIN.');
      S.quien = nombre; S.pin = pin;
      cargando(true);
      api('inicial').then(function () {
        lsSet('quien', nombre); lsSet('pin', pin);
        if (!location.hash || location.hash === '#/') location.hash = '/lista'; else pintar();
      }).catch(function (e) {
        S.quien = null; S.pin = null;
        $('#lError').textContent = e.codigo === 'CLAVE' ? 'PIN incorrecto.' : (e.message || 'No se pudo conectar. Revisa la dirección API_URL de config.js.');
      }).then(function () { cargando(false); });
    }
    $('#lEntrar').onclick = entrar;
    $('#lPin').onkeydown = function (e) { if (e.key === 'Enter') entrar(); };
  }
  function salir(msg) { lsDel('pin'); lsDel('cache'); S.pin = null; S.quien = null; S.datos = null; location.hash = ''; pintarLogin(msg); }

  // ---------------- Tarjeta de tarea ----------------
  function bloquePrio(t) {
    var c = clasePrio(t);
    var ic = { hecha: '✓', urgente: '!', alta: '▲', media: '●', baja: '▼' }[c];
    var tx = { hecha: 'Hecha', urgente: 'Urgente', alta: 'Alta', media: 'Media', baja: 'Baja' }[c];
    return '<div class="prio ' + c + '"><span class="ic">' + ic + '</span><span class="tx">' + tx + '</span></div>';
  }
  function etiquetas(t, conCat) {
    var e = '';
    if (t.estado !== 'Pendiente') e += '<span class="etiqueta ' + claseEstado(t.estado) + '">' + esc(t.estado) + '</span>';
    if (t.urgente && t.prioridad !== 'Alta' && t.estado !== 'Hecha') e += '<span class="etiqueta">Prioridad ' + esc(t.prioridad).toLowerCase() + '</span>';
    if (conCat && nombreCategoria(t)) e += '<span class="etiqueta cat">' + esc(nombreCategoria(t)) + '</span>';
    if (t.responsable) e += '<span class="etiqueta persona">' + esc(t.responsable) + '</span>';
    if (t.limite && t.estado !== 'Hecha') e += '<span class="etiqueta ' + (vencida(t) ? 'vencida' : 'fecha') + '">' + (vencida(t) ? 'Venció ' : 'Hasta ') + corta(t.limite) + '</span>';
    if (t.estado === 'Hecha' && t.hechaEl) e += '<span class="etiqueta fecha">' + legible(String(t.hechaEl).slice(0, 10)) + '</span>';
    var nf = fotosDe(t.id).length;
    if (nf) e += '<span class="etiqueta foto">' + nf + ' foto' + (nf === 1 ? '' : 's') + '</span>';
    return e ? '<div class="etiquetas">' + e + '</div>' : '';
  }
  function tarjeta(t) {
    return '<button class="tarea" data-id="' + esc(t.id) + '">' + bloquePrio(t) +
      '<div class="info"><b>' + esc(t.titulo) + '</b>' +
      '<span class="sub lugar">' + esc(textoLugar(t) || 'Sin espacio') + '</span>' +
      etiquetas(t, true) + '</div></button>';
  }
  function enlazarTarjetas() {
    $$('.tarea[data-id]').forEach(function (b) { b.onclick = function () { ir('tarea/' + encodeURIComponent(b.dataset.id)); }; });
  }

  // ---------------- Lista de pendientes ----------------
  function opciones(k, sel, todas) {
    return '<option value="">' + todas + '</option>' + lista(k).filter(function (e) { return e.activo || e.id === sel; }).map(function (e) {
      return '<option value="' + esc(e.id) + '"' + (e.id === sel ? ' selected' : '') + '>' + esc(e.codigo ? e.codigo + ' · ' + e.nombre : e.nombre) + '</option>';
    }).join('');
  }
  function coincide(t, texto) {
    if (!texto) return true;
    var q = sinAcentos(texto);
    return sinAcentos([t.titulo, t.descripcion, t.notas, t.lugar, nombreEspacio(t), codigoEspacio(t), nombreCategoria(t), t.responsable].join(' ')).indexOf(q) >= 0;
  }
  function pintarLista() {
    var f = S.f;
    var abiertas = tareas().filter(function (t) { return t.estado !== 'Hecha'; });
    var base = abiertas.filter(function (t) {
      return (!f.cat || t.categoriaId === f.cat) && (!f.esp || t.espacioId === f.esp) && (!f.soloUrg || t.urgente) && coincide(t, f.texto);
    });
    var cuenta = function (e) { return base.filter(function (t) { return e === 'abiertas' || t.estado === e; }).length; };
    var visibles = ordenar(base.filter(function (t) { return f.estado === 'abiertas' || t.estado === f.estado; }));
    var hayFiltro = f.cat || f.esp || f.soloUrg || f.texto;
    vista.innerHTML =
      '<div class="buscador">' + ICO.buscar + '<input class="entrada" id="fTexto" type="search" placeholder="Buscar…" value="' + esc(f.texto) + '"></div>' +
      '<div class="segmento cuatro" id="fEstado">' +
      [['abiertas', 'Todas'], ['Pendiente', 'Pendientes'], ['En curso', 'En curso'], ['Esperando', 'Esperando']].map(function (x) {
        return '<button data-e="' + x[0] + '" class="' + (f.estado === x[0] ? 'activo' : '') + '">' + x[1] + '<small>' + cuenta(x[0]) + '</small></button>';
      }).join('') + '</div>' +
      '<div class="filtros"><select class="entrada' + (f.esp ? ' activo' : '') + '" id="fEsp">' + opciones('espacios', f.esp, 'Todos los espacios') + '</select>' +
      '<select class="entrada' + (f.cat ? ' activo' : '') + '" id="fCat">' + opciones('categorias', f.cat, 'Todas las categorías') + '</select></div>' +
      '<div class="resumen"><label class="sub check"><input type="checkbox" id="fUrg"' + (f.soloUrg ? ' checked' : '') + '> Solo urgentes</label>' +
      (hayFiltro ? '<button class="limpiar" id="fLimpiar">Quitar filtros</button>' : '') + '</div>' +
      (visibles.length ? visibles.map(tarjeta).join('')
        : '<div class="vacio">' + (abiertas.length ? 'Nada con estos filtros.' : '¡Todo al día! No hay necesidades pendientes.') + '</div>');
    var tTexto;
    $('#fTexto').oninput = function () {
      var v = this.value; clearTimeout(tTexto);
      tTexto = setTimeout(function () { S.f.texto = v; pintarLista(); var i = $('#fTexto'); i.focus(); i.setSelectionRange(v.length, v.length); }, 250);
    };
    $('#fEstado').onclick = function (e) { var b = e.target.closest('button'); if (b) { S.f.estado = b.dataset.e; pintarLista(); } };
    $('#fEsp').onchange = function () { S.f.esp = this.value; pintarLista(); };
    $('#fCat').onchange = function () { S.f.cat = this.value; pintarLista(); };
    $('#fUrg').onchange = function () { S.f.soloUrg = this.checked; pintarLista(); };
    if ($('#fLimpiar')) $('#fLimpiar').onclick = function () { S.f = { estado: S.f.estado, cat: '', esp: '', texto: '', soloUrg: false }; pintarLista(); };
    enlazarTarjetas();
  }

  // ---------------- Hechas (historial) ----------------
  function pintarHechas() {
    var lista_ = tareas().filter(function (t) { return t.estado === 'Hecha' && coincide(t, S.textoHechas); })
      .sort(function (a, b) { return String(b.hechaEl).localeCompare(String(a.hechaEl)); });
    vista.innerHTML =
      '<div class="buscador">' + ICO.buscar + '<input class="entrada" id="hTexto" type="search" placeholder="Buscar en hechas…" value="' + esc(S.textoHechas) + '"></div>' +
      '<p class="sub" style="margin:0 0 8px">' + lista_.length + ' necesidad' + (lista_.length === 1 ? '' : 'es') + ' resuelta' + (lista_.length === 1 ? '' : 's') + ', de la más reciente a la más antigua.</p>' +
      (lista_.length ? lista_.map(tarjeta).join('') : '<div class="vacio">Aún no hay nada marcado como hecho.</div>');
    var tTexto;
    $('#hTexto').oninput = function () {
      var v = this.value; clearTimeout(tTexto);
      tTexto = setTimeout(function () { S.textoHechas = v; pintarHechas(); var i = $('#hTexto'); i.focus(); i.setSelectionRange(v.length, v.length); }, 250);
    };
    enlazarTarjetas();
  }

  // ---------------- Detalle ----------------
  function pintarDetalle(id) {
    var t = tarea(id);
    if (!t) { vista.innerHTML = botonVolver() + '<div class="vacio">Esta necesidad ya no existe.</div>'; return enlazarVolver(); }
    var dato = function (k, v) { return v ? '<div class="dato"><span>' + k + '</span><span>' + v + '</span></div>' : ''; };
    vista.innerHTML = botonVolver() +
      '<div class="tarjeta det ' + clasePrio(t) + '"><h2>' + esc(t.titulo) + '</h2>' + etiquetas(t, false) +
      '<div style="margin-top:10px">' +
      dato('Espacio', esc((codigoEspacio(t) ? codigoEspacio(t) + ' · ' : '') + nombreEspacio(t))) +
      dato('Lugar exacto', esc(t.lugar)) +
      dato('Categoría', esc(nombreCategoria(t))) +
      dato('Prioridad', esc(t.prioridad) + (t.urgente ? ' · <span style="color:var(--tel)">urgente</span>' : '')) +
      dato('Responsable', esc(t.responsable)) +
      dato('Fecha límite', t.limite ? '<span' + (vencida(t) ? ' style="color:var(--tel)"' : '') + '>' + legible(t.limite) + '</span>' : '') +
      '</div>' +
      (t.descripcion ? '<h3>Descripción</h3><p class="texto-largo">' + esc(t.descripcion) + '</p>' : '') +
      (t.notas ? '<h3>Notas</h3><p class="texto-largo">' + esc(t.notas) + '</p>' : '') + '</div>' +
      '<div class="tarjeta estado-rapido"><h2>Estado</h2><div class="segmento cuatro" id="dEstado">' +
      ESTADOS.map(function (e) { return '<button data-e="' + e + '" class="e-' + claseEstado(e) + (t.estado === e ? ' activo' : '') + '">' + e + '</button>'; }).join('') +
      '</div></div>' +
      bloqueFotosTarea(t) + bloqueSeguimiento(t) +
      '<div class="fila-btns" style="margin-bottom:12px"><button class="btn" id="dEditar">Editar</button><button class="btn peligro" id="dBorrar">Borrar</button></div>' +
      '<p class="pie-meta">Apuntada por ' + esc(t.creadoPor || '—') + ' el ' + legible(t.creadoEl) +
      (t.modificadoEl && t.modificadoEl !== t.creadoEl ? '<br>Último cambio: ' + esc(t.modificadoPor) + ', ' + legible(t.modificadoEl) : '') +
      (t.hechaEl ? '<br>Hecha el ' + legible(t.hechaEl) : '') + '</p>';
    enlazarVolver();
    $('#dEstado').onclick = function (e) {
      var b = e.target.closest('button'); if (!b || b.dataset.e === t.estado) return;
      guardar('cambiarEstado', { id: t.id, estado: b.dataset.e }, 'Estado: ' + b.dataset.e).then(function () { pintar(); }, function () {});
    };
    $('#dFotoCam').onclick = function () {
      elegirArchivos(true, false).then(function (a) { return subirFotos(a, t.id); }).then(function (ids) { if (ids.length) pintar(); });
    };
    $('#dFotoRepo').onclick = function () { modalElegirFotos(t.id); };
    enlazarSeguimiento(t);
    enlazarFotos(vista);
    $('#dEditar').onclick = function () { ir('editar/' + encodeURIComponent(t.id)); };
    $('#dBorrar').onclick = function () {
      confirmar('¿Borrar «' + esc(t.titulo) + '»? No se puede deshacer. Si ya está resuelta, mejor márcala como <b>Hecha</b> para que quede en el historial.', 'Borrar', true).then(function (ok) {
        if (!ok) return;
        guardar('borrarTarea', { id: t.id }, 'Borrada').then(function () { ir('lista'); }, function () {});
      });
    };
  }

  // ---------------- Fotos (repositorio en Google Drive) ----------------
  var cacheImg = {}, pidiendo = {};
  function fotos() { return (S.datos && S.datos.fotos) || []; }
  function foto(id) { return fotos().filter(function (f) { return f.id === id; })[0]; }
  function fotosDe(tid) { return fotos().filter(function (f) { return f.tareas.indexOf(tid) >= 0; }); }
  function grupoFoto(f) { return f.archivada ? 'archivadas' : (f.tareas.some(function (x) { return tarea(x); }) ? 'asignadas' : 'sin'); }
  function urlFoto(f, grande) { return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(f.archivo) + '&sz=w' + (grande ? 1600 : 400); }
  function htmlImg(id, grande) { return '<img data-foto="' + esc(id) + '"' + (grande ? ' data-grande="1"' : '') + ' alt="" loading="lazy">'; }
  /** La imagen a través del script: si Drive no la enseña con el enlace, o en demostración. */
  function verFoto(id, grande) {
    var k = id + (grande ? 'g' : 'p');
    if (cacheImg[k]) return Promise.resolve(cacheImg[k]);
    if (!pidiendo[k]) pidiendo[k] = api('verFoto', { id: id, grande: !!grande })
      .then(function (d) { cacheImg[k] = d.data; delete pidiendo[k]; return d.data; }, function (e) { delete pidiendo[k]; throw e; });
    return pidiendo[k];
  }
  function activarImagenes(el) {
    $$('img[data-foto]', el).forEach(function (img) {
      if (img.dataset.listo) return;
      img.dataset.listo = '1';
      var id = img.dataset.foto, grande = !!img.dataset.grande, f = foto(id), k = id + (grande ? 'g' : 'p');
      if (cacheImg[k]) { img.src = cacheImg[k]; return; }
      var porScript = function () {
        img.onerror = null; img.classList.add('esperando');
        verFoto(id, grande).then(function (u) { img.src = u; img.classList.remove('esperando'); },
          function () { img.classList.remove('esperando'); img.classList.add('rota'); });
      };
      if (DEMO || !f || S.driveNoVa) return porScript();
      img.onerror = function () { S.driveNoVa = true; porScript(); };
      img.src = urlFoto(f, grande);
    });
  }
  /** Reduce la foto en el móvil (lado mayor 1600 px, JPEG) antes de enviarla. */
  function reducirImagen(archivo) {
    return new Promise(function (ok, ko) {
      var url = URL.createObjectURL(archivo), img = new Image();
      img.onload = function () {
        var max = 1600, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        ok(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = function () { URL.revokeObjectURL(url); ko(new Error('No se pudo leer la imagen «' + (archivo.name || '') + '».')); };
      img.src = url;
    });
  }
  function elegirArchivos(camara, varias) {
    $$('input.selector-foto').forEach(function (x) { x.remove(); });
    return new Promise(function (ok) {
      var i = document.createElement('input');
      i.type = 'file'; i.accept = 'image/*'; i.className = 'selector-foto'; i.hidden = true;
      if (camara) i.setAttribute('capture', 'environment');
      if (varias) i.multiple = true;
      document.body.appendChild(i);
      i.onchange = function () { var a = Array.prototype.slice.call(i.files || []); i.remove(); ok(a); };
      i.click();
    });
  }
  /** Sube las fotos una a una. Con tareaId quedan asignadas a esa tarea. Devuelve los ID guardados. */
  function subirFotos(archivos, tareaId) {
    if (!archivos.length) return Promise.resolve([]);
    if (S.sinConexion) { toast('Sin conexión: no se pueden subir fotos ahora.', true); return Promise.resolve([]); }
    var ids = [], i = 0;
    function siguiente() {
      if (i >= archivos.length) return Promise.resolve(ids);
      var a = archivos[i++];
      cargando(true);
      return reducirImagen(a).then(function (b64) {
        return guardar('subirFoto', { base64: b64, tipo: 'image/jpeg', tareaId: tareaId || '' });
      }, function (e) { cargando(false); toast(e.message, true); throw e; })
        .then(function (d) { ids.push(d.id); return siguiente(); }, function () { return ids; });
    }
    return siguiente().then(function (r) { if (r.length) toast(r.length === 1 ? 'Foto guardada' : r.length + ' fotos guardadas'); return r; });
  }
  function miniatura(f) {
    var n = f.tareas.filter(function (x) { return tarea(x); }).length;
    return '<button class="mini-foto" data-ver="' + esc(f.id) + '">' + htmlImg(f.id) +
      '<span class="pie">' + corta(f.fecha) + (n ? ' · ' + n + ' tarea' + (n === 1 ? '' : 's') : '') + '</span></button>';
  }
  function enlazarFotos(el) {
    $$('[data-ver]', el).forEach(function (b) { b.onclick = function () { modalFoto(b.dataset.ver); }; });
    activarImagenes(el);
  }
  function pintarFotos() {
    var g = S.fotosF, cuenta = { sin: 0, asignadas: 0, archivadas: 0 };
    fotos().forEach(function (f) { cuenta[grupoFoto(f)]++; });
    var vis = fotos().filter(function (f) { return grupoFoto(f) === g; });
    var ayuda = { sin: 'Fotos que aún no están en ninguna tarea. Toca una para asignarla.',
                  asignadas: 'Fotos que están en alguna tarea abierta.',
                  archivadas: 'Fotos de tareas ya hechas (en la carpeta «Archivo» de Drive).' }[g];
    vista.innerHTML =
      '<div class="fila-btns" style="margin-bottom:12px"><button class="btn" id="fCam">' + ICO.camara + 'Hacer foto</button>' +
      '<button class="btn sec" id="fGal">' + ICO.galeria + 'Galería</button></div>' +
      '<div class="segmento tres" id="fGrupo">' + [['sin', 'Sin asignar'], ['asignadas', 'En tareas'], ['archivadas', 'Archivadas']].map(function (x) {
        return '<button data-g="' + x[0] + '" class="' + (g === x[0] ? 'activo' : '') + '">' + x[1] + '<small>' + cuenta[x[0]] + '</small></button>';
      }).join('') + '</div>' +
      '<p class="sub" style="margin:8px 0 0">' + ayuda + '</p>' +
      (vis.length ? '<div class="rejilla-fotos">' + vis.map(miniatura).join('') + '</div>' : '<div class="vacio">No hay fotos aquí.</div>');
    $('#fGrupo').onclick = function (e) { var b = e.target.closest('button'); if (b) { S.fotosF = b.dataset.g; pintarFotos(); } };
    var tras = function (ids) { if (!ids.length) return; S.fotosF = 'sin'; pintar(); if (ids.length === 1) modalFoto(ids[0]); };
    $('#fCam').onclick = function () { elegirArchivos(true, false).then(function (a) { return subirFotos(a); }).then(tras); };
    $('#fGal').onclick = function () { elegirArchivos(false, true).then(function (a) { return subirFotos(a); }).then(tras); };
    enlazarFotos(vista);
  }
  /** Ver una foto en grande, ponerle nota y elegir sus tareas (puede estar en varias). */
  function modalFoto(id) {
    var f = foto(id); if (!f) return;
    var cand = ordenar(tareas().filter(function (t) { return t.estado !== 'Hecha' || f.tareas.indexOf(t.id) >= 0; }));
    modal('<div class="foto-grande">' + htmlImg(f.id, true) + '</div>' +
      '<p class="sub" style="margin:8px 0 12px">' + legible(f.fecha) + ' · ' + esc(f.usuario) + (f.archivada ? ' · archivada' : '') + '</p>' +
      '<label class="campo"><span>Nota</span><input class="entrada" id="ftNota" maxlength="300" placeholder="Ej.: Humedad bajo la ventana" value="' + esc(f.nota) + '"></label>' +
      '<label class="campo"><span>Tareas de esta foto</span></label>' +
      (cand.length > 6 ? '<input class="entrada" id="ftBuscar" type="search" placeholder="Buscar tarea…" style="margin:-6px 0 8px">' : '') +
      (cand.length ? '<div class="lista-check" id="ftTareas">' + cand.map(function (t) {
        return '<label class="check fila-tarea" data-txt="' + esc(sinAcentos(t.titulo + ' ' + textoLugar(t))) + '"><input type="checkbox" value="' + esc(t.id) + '"' +
          (f.tareas.indexOf(t.id) >= 0 ? ' checked' : '') + '><span><b>' + esc(t.titulo) + '</b><small>' +
          esc([textoLugar(t), t.estado === 'Hecha' ? 'hecha' : ''].filter(Boolean).join(' · ')) + '</small></span></label>';
      }).join('') + '</div>' : '<p class="sub">No hay tareas abiertas.</p>') +
      '<p class="error-txt" id="ftError"></p>' +
      '<div class="fila-btns"><button class="btn borde" data-r="0">Cerrar</button><button class="btn" data-r="1">Guardar</button></div>' +
      '<div class="fila-btns" style="margin-top:10px">' +
      (DEMO ? '' : '<a class="btn borde mini" href="https://drive.google.com/file/d/' + encodeURIComponent(f.archivo) + '/view" target="_blank" rel="noopener">Abrir en Drive</a>') +
      '<button class="btn peligro mini" data-r="borrar">' + ICO.borrar + 'Borrar foto</button></div>',
      function (ev, cerrar) {
        var b = ev.target.closest('[data-r]'); if (!b) return;
        if (b.dataset.r === '0') return cerrar();
        if (b.dataset.r === 'borrar') {
          var n = f.tareas.filter(function (x) { return tarea(x); }).length;
          return confirmar('¿Borrar esta foto?' + (n ? ' Está en ' + n + ' tarea' + (n === 1 ? '' : 's') + ' y desaparecerá de ellas.' : '') + ' Irá a la papelera de Drive.', 'Borrar', true).then(function (ok) {
            if (!ok) return modalFoto(id);
            guardar('borrarFoto', { id: id }, 'Foto borrada').then(function () { pintar(); }, function () {});
          });
        }
        var ts = $$('#ftTareas input:checked').map(function (x) { return x.value; });
        guardar('guardarFoto', { id: id, nota: $('#ftNota').value.trim(), tareas: ts }, 'Guardado').then(function () { cerrar(); pintar(); },
          function (err) { if ($('#ftError')) $('#ftError').textContent = err.message; });
      });
    activarImagenes($('#modal'));
    if ($('#ftBuscar')) $('#ftBuscar').oninput = function () {
      var q = sinAcentos(this.value);
      $$('#ftTareas .fila-tarea').forEach(function (l) { l.hidden = q && l.dataset.txt.indexOf(q) < 0; });
    };
  }
  /** Elegir fotos del repositorio para una tarea (primero las sin asignar). */
  function modalElegirFotos(tid) {
    var disp = fotos().filter(function (f) { return f.tareas.indexOf(tid) < 0 && !f.archivada; });
    disp = disp.filter(function (f) { return grupoFoto(f) === 'sin'; }).concat(disp.filter(function (f) { return grupoFoto(f) !== 'sin'; }));
    var sel = [];
    modal('<h2>Añadir fotos a la tarea</h2>' +
      (disp.length ? '<p class="sub" style="margin:0 0 4px">Toca las fotos que quieras añadir.</p><div class="rejilla-fotos elegir">' + disp.map(function (f) {
        return '<button class="mini-foto" data-elegir="' + esc(f.id) + '">' + htmlImg(f.id) + '<span class="pie">' +
          (grupoFoto(f) === 'sin' ? 'Sin asignar' : corta(f.fecha) + ' · en otra tarea') + '</span><span class="marca">✓</span></button>';
      }).join('') + '</div>' : '<p class="sub">No hay fotos en el repositorio para añadir.</p>') +
      '<button class="btn borde ancho mini" data-r="galeria" style="margin:4px 0 12px">' + ICO.galeria + 'Subir desde la galería</button>' +
      '<div class="fila-btns"><button class="btn borde" data-r="0">Cancelar</button><button class="btn" data-r="1" id="elOk" disabled>Añadir</button></div>',
      function (ev, cerrar) {
        var e = ev.target.closest('[data-elegir]');
        if (e) {
          var i = sel.indexOf(e.dataset.elegir);
          if (i < 0) sel.push(e.dataset.elegir); else sel.splice(i, 1);
          e.classList.toggle('sel', i < 0);
          $('#elOk').disabled = !sel.length; $('#elOk').textContent = sel.length ? 'Añadir (' + sel.length + ')' : 'Añadir';
          return;
        }
        var b = ev.target.closest('[data-r]'); if (!b) return;
        if (b.dataset.r === '0') return cerrar();
        if (b.dataset.r === 'galeria') { cerrar(); return elegirArchivos(false, true).then(function (a) { return subirFotos(a, tid); }).then(function (ids) { if (ids.length) pintar(); }); }
        guardar('fotosATarea', { tareaId: tid, fotos: sel }, sel.length === 1 ? 'Foto añadida' : sel.length + ' fotos añadidas').then(function () { cerrar(); pintar(); }, function () {});
      });
    activarImagenes($('#modal'));
  }
  function bloqueFotosTarea(t) {
    var fs = fotosDe(t.id);
    return '<div class="tarjeta"><h2 class="con-num">Fotos<small>' + fs.length + '</small></h2>' +
      (fs.length ? '<div class="tira-fotos">' + fs.map(function (f) { return '<button class="mini-foto" data-ver="' + esc(f.id) + '">' + htmlImg(f.id) + '</button>'; }).join('') + '</div>'
        : '<p class="sub" style="margin:0 0 10px">Sin fotos todavía.</p>') +
      '<div class="fila-btns"><button class="btn sec mini" id="dFotoCam">' + ICO.camara + 'Hacer foto</button>' +
      '<button class="btn sec mini" id="dFotoRepo">' + ICO.galeria + 'Del repositorio</button></div></div>';
  }

  // ---------------- Seguimiento (avances de cada tarea, plegados por día) ----------------
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var ICO_SEG = { alta: '＋', estado: '⇄', cambio: '✎', foto: '📷' };
  function nombreDia(d) {
    var hoy = hoyTxt();
    if (d === hoy) return 'Hoy';
    if (d === sumaDias(hoy, -1)) return 'Ayer';
    var p = d.split('-'), n = DIAS[new Date(+p[0], +p[1] - 1, +p[2]).getDay()];
    return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + legible(d);
  }
  function seguimientoDe(tid) {
    return ((S.datos && S.datos.seguimiento) || []).filter(function (e) { return e.tareaId === tid; })
      .sort(function (a, b) { return b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id); });
  }
  function entradaSeg(e) {
    var fs = e.fotos.filter(function (id) { return foto(id); });
    return '<li class="ent ' + (e.tipo === 'nota' ? 'nota' : 'auto') + '"><span class="hora">' + esc(e.fecha.slice(11, 16)) + '</span>' +
      '<div class="cuerpo"><b>' + esc(e.usuario) + '</b>' + (ICO_SEG[e.tipo] ? '<span class="ic-seg">' + ICO_SEG[e.tipo] + '</span> ' : '') +
      (e.texto ? '<span class="txt">' + esc(e.texto) + '</span>' : '') +
      (fs.length ? '<div class="tira-fotos peq">' + fs.map(function (id) { return '<button class="mini-foto" data-ver="' + esc(id) + '">' + htmlImg(id) + '</button>'; }).join('') + '</div>' : '') +
      '</div><button class="ent-menu" data-ent="' + esc(e.id) + '" aria-label="Opciones">⋯</button></li>';
  }
  function bloqueSeguimiento(t) {
    var ents = seguimientoDe(t.id), b = S.borrador[t.id] || { texto: '', fotos: [] }, ab = S.seg[t.id] || {}, dias = [];
    ents.forEach(function (e) {
      var d = e.fecha.slice(0, 10), g = dias[dias.length - 1];
      if (!g || g.dia !== d) dias.push(g = { dia: d, items: [] });
      g.items.push(e);
    });
    var adj = b.fotos.filter(function (id) { return foto(id); });
    return '<div class="tarjeta seg"><h2 class="con-num">Seguimiento<small>' + ents.length + '</small></h2>' +
      '<div class="seg-nuevo"><textarea class="entrada" id="sTexto" maxlength="2000" placeholder="Añadir avance: qué se ha hecho, qué falta…">' + esc(b.texto) + '</textarea>' +
      (adj.length ? '<div class="tira-fotos">' + adj.map(function (id) {
        return '<span class="mini-foto">' + htmlImg(id) + '<button class="quitar" data-quitar="' + esc(id) + '" aria-label="Quitar">×</button></span>';
      }).join('') + '</div>' : '') +
      '<div class="seg-acc"><button class="btn borde mini" id="sFoto">' + ICO.camara + 'Foto</button><button class="btn mini" id="sAnotar">Anotar</button></div></div>' +
      (dias.length ? '<div class="arbol">' + dias.map(function (g, i) {
        var abierto = ab[g.dia] != null ? ab[g.dia] : i === 0;
        return '<details class="dia" data-dia="' + g.dia + '"' + (abierto ? ' open' : '') + '><summary><span>' + esc(nombreDia(g.dia)) + '</span><small>' + g.items.length + '</small></summary>' +
          '<ul>' + g.items.map(entradaSeg).join('') + '</ul></details>';
      }).join('') + '</div>' : '<p class="sub" style="margin:12px 0 0">Todavía no hay avances.</p>') + '</div>';
  }
  function enlazarSeguimiento(t) {
    var borr = function () { return S.borrador[t.id] || (S.borrador[t.id] = { texto: '', fotos: [] }); };
    $('#sTexto').oninput = function () { borr().texto = this.value; };
    $('#sFoto').onclick = function () {
      elegirArchivos(false, true).then(function (a) { return subirFotos(a); }).then(function (ids) {
        if (!ids.length) return;
        borr().fotos = borr().fotos.concat(ids); pintar();
      });
    };
    $$('[data-quitar]', vista).forEach(function (x) {
      x.onclick = function () { var b = borr(); b.fotos = b.fotos.filter(function (id) { return id !== x.dataset.quitar; }); pintar(); };
    });
    $('#sAnotar').onclick = function () {
      var b = borr();
      b.texto = $('#sTexto').value.trim();
      if (!b.texto && !b.fotos.length) { toast('Escribe algo o añade una foto.', true); $('#sTexto').focus(); return; }
      guardar('anotar', { tareaId: t.id, texto: b.texto, fotos: b.fotos }, 'Anotado').then(function () {
        delete S.borrador[t.id];
        (S.seg[t.id] = S.seg[t.id] || {})[hoyTxt()] = true;
        pintar();
      }, function () {});
    };
    $$('details.dia', vista).forEach(function (d) {
      d.addEventListener('toggle', function () { (S.seg[t.id] = S.seg[t.id] || {})[d.dataset.dia] = d.open; });
    });
    $$('[data-ent]', vista).forEach(function (x) { x.onclick = function () { modalEntrada(x.dataset.ent); }; });
  }
  function modalEntrada(id) {
    var e = ((S.datos && S.datos.seguimiento) || []).filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    var nota = e.tipo === 'nota';
    modal('<h2>' + (nota ? 'Editar avance' : 'Entrada automática') + '</h2>' +
      '<p class="sub" style="margin:0 0 10px">' + legible(e.fecha) + ' · ' + esc(e.usuario) + '</p>' +
      (nota ? '<label class="campo"><textarea class="entrada" id="enTexto" maxlength="2000">' + esc(e.texto) + '</textarea></label>'
        : '<p class="texto-largo">' + esc(e.texto) + '</p>') +
      '<p class="error-txt" id="enError"></p>' +
      '<div class="fila-btns"><button class="btn peligro" data-r="borrar">Borrar</button><button class="btn borde" data-r="0">Cerrar</button>' +
      (nota ? '<button class="btn" data-r="1">Guardar</button>' : '') + '</div>',
      function (ev, cerrar) {
        var b = ev.target.closest('[data-r]'); if (!b) return;
        if (b.dataset.r === '0') return cerrar();
        if (b.dataset.r === 'borrar') {
          return confirmar('¿Borrar esta entrada del seguimiento?' + (e.fotos.length ? ' Las fotos siguen en la tarea y en el repositorio.' : ''), 'Borrar', true).then(function (ok) {
            if (!ok) return modalEntrada(id);
            guardar('borrarAnotacion', { id: id }, 'Entrada borrada').then(function () { pintar(); }, function () {});
          });
        }
        guardar('editarAnotacion', { id: id, texto: $('#enTexto').value.trim() }, 'Guardado').then(function () { cerrar(); pintar(); },
          function (err) { if ($('#enError')) $('#enError').textContent = err.message; });
      });
  }

  // ---------------- Formulario (nueva / editar) ----------------
  function pintarFormulario(id) {
    var t = id ? tarea(id) : null;
    if (id && !t) { vista.innerHTML = botonVolver() + '<div class="vacio">Esta necesidad ya no existe.</div>'; return enlazarVolver(); }
    var v = t ? JSON.parse(JSON.stringify(t)) : { titulo: '', espacioId: S.f.esp || '', categoriaId: S.f.cat || '', lugar: '', prioridad: 'Media', urgente: false, estado: 'Pendiente', responsable: '', limite: '', descripcion: '', notas: '' };
    var resp = lista('responsables').filter(function (r) { return r.activo || r.nombre === v.responsable; }).map(function (r) { return r.nombre; });
    if (v.responsable && resp.indexOf(v.responsable) < 0) resp.push(v.responsable);
    vista.innerHTML = (t ? botonVolver() : '') +
      '<div class="tarjeta">' +
      '<label class="campo"><span>¿Qué hace falta? *</span><input class="entrada" id="nTitulo" maxlength="150" placeholder="Ej.: El grifo del baño gotea" value="' + esc(v.titulo) + '"></label>' +
      '<div class="dos"><label class="campo"><span>Espacio</span><select class="entrada" id="nEsp">' + opciones('espacios', v.espacioId, '— Elegir —') + '</select></label>' +
      '<label class="campo"><span>Categoría</span><select class="entrada" id="nCat">' + opciones('categorias', v.categoriaId, '— Elegir —') + '</select></label></div>' +
      '<label class="campo"><span>Lugar exacto</span><input class="entrada" id="nLugar" maxlength="120" placeholder="Ej.: Hab. 12, ventana de la izquierda" value="' + esc(v.lugar) + '"></label>' +
      '<label class="campo"><span>Prioridad</span></label><div class="segmento tres prioridad" id="nPrio" style="margin:-6px 0 12px">' +
      PRIORIDADES.map(function (p) { return '<button type="button" data-p="' + p + '" class="p-' + p.toLowerCase() + (v.prioridad === p ? ' activo' : '') + '">' + p + '</button>'; }).join('') + '</div>' +
      '<label class="urg' + (v.urgente ? ' on' : '') + '" id="nUrgL"><input type="checkbox" id="nUrg"' + (v.urgente ? ' checked' : '') + '> Es urgente</label>' +
      (t ? '<label class="campo"><span>Estado</span></label><div class="segmento cuatro" id="nEstado" style="margin:-6px 0 12px">' +
        ESTADOS.map(function (e) { return '<button type="button" data-e="' + e + '" class="' + (v.estado === e ? 'activo' : '') + '">' + e + '</button>'; }).join('') + '</div>' : '') +
      '<div class="dos"><label class="campo"><span>Responsable</span><select class="entrada" id="nResp"><option value="">Sin asignar</option>' +
      resp.map(function (n) { return '<option' + (n === v.responsable ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></label>' +
      '<label class="campo"><span>Fecha límite</span><input class="entrada" id="nLimite" type="date" value="' + esc(v.limite) + '"></label></div>' +
      '<label class="campo"><span>Descripción</span><textarea class="entrada" id="nDesc" maxlength="2000" placeholder="Detalles, medidas, material necesario…">' + esc(v.descripcion) + '</textarea></label>' +
      (t ? '<label class="campo"><span>Notas</span><textarea class="entrada" id="nNotas" maxlength="2000" placeholder="Ej.: Llamado al fontanero el lunes">' + esc(v.notas) + '</textarea></label>' : '') +
      '<p class="error-txt" id="nError"></p></div>' +
      '<div class="pie-form"><button class="btn borde" id="nCancelar">Cancelar</button><button class="btn" id="nGuardar">' + (t ? 'Guardar cambios' : 'Apuntar') + '</button></div>';
    enlazarVolver();
    $('#nPrio').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; v.prioridad = b.dataset.p; $$('button', this).forEach(function (x) { x.classList.toggle('activo', x === b); }); };
    $('#nUrg').onchange = function () { v.urgente = this.checked; $('#nUrgL').classList.toggle('on', this.checked); };
    if ($('#nEstado')) $('#nEstado').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; v.estado = b.dataset.e; $$('button', this).forEach(function (x) { x.classList.toggle('activo', x === b); }); };
    $('#nCancelar').onclick = function () { if (t) volver(); else ir('lista'); };
    $('#nGuardar').onclick = function () {
      v.titulo = $('#nTitulo').value.trim();
      if (!v.titulo) { $('#nError').textContent = 'Escribe qué hace falta.'; $('#nTitulo').focus(); return; }
      v.espacioId = $('#nEsp').value; v.categoriaId = $('#nCat').value; v.lugar = $('#nLugar').value.trim();
      v.responsable = $('#nResp').value; v.limite = $('#nLimite').value; v.descripcion = $('#nDesc').value.trim();
      if ($('#nNotas')) v.notas = $('#nNotas').value.trim();
      guardar('guardarTarea', { tarea: v }, t ? 'Cambios guardados' : 'Apuntada').then(function (d) {
        if (t) { history.length > 1 && historial > 0 ? history.back() : ir('tarea/' + encodeURIComponent(t.id)); }
        else ir('lista');
      }, function (e) { if (e && e.message !== 'sin conexión') $('#nError').textContent = e.message; });
    };
    if (!t) setTimeout(function () { $('#nTitulo') && $('#nTitulo').focus(); }, 50);
  }

  // ---------------- Proveedores (agenda de teléfonos) ----------------
  function proveedores() { return (S.datos && S.datos.proveedores) || []; }
  function proveedor(id) { return proveedores().filter(function (p) { return p.id === id; })[0]; }
  function soloDigitos(s) { return String(s || '').replace(/[^\d+]/g, ''); }
  function hrefTel(s) { var d = soloDigitos(s); return 'tel:' + (/^\d{9}$/.test(d) ? '+34' + d : d); }
  function hrefWeb(s) { s = String(s || '').trim(); return /^https?:\/\//i.test(s) ? s : 'https://' + s; }
  function hrefMapa(s) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s); }
  /** Texto con los teléfonos de 9 cifras convertidos en enlaces para llamar. */
  function conTelefonos(texto) {
    return esc(texto).replace(/(\+?\d[\d ]{7,14}\d)/g, function (m) {
      return soloDigitos(m).replace('+', '').length >= 9 ? '<a href="' + hrefTel(m) + '">' + m + '</a>' : m;
    });
  }
  function servicios() {
    var vistos = [];
    proveedores().forEach(function (p) { if (p.servicio && vistos.indexOf(p.servicio) < 0) vistos.push(p.servicio); });
    return vistos;
  }
  function coincideProv(p, texto) {
    if (!texto) return true;
    var q = sinAcentos(texto), qd = texto.replace(/\D/g, '');
    var todo = [p.servicio, p.empresa, p.contacto, p.tel1, p.tel2, p.email, p.direccion, p.web, p.notas].join(' ');
    return sinAcentos(todo).indexOf(q) >= 0 || (qd.length >= 3 && todo.replace(/\D/g, '').indexOf(qd) >= 0);
  }
  function fichaProveedor(p) {
    var b = '';
    [p.tel1, p.tel2].forEach(function (t) { if (t) b += '<a class="btn mini llamar" href="' + esc(hrefTel(t)) + '">' + ICO.tel + esc(t) + '</a>'; });
    if (p.email) b += '<a class="btn mini sec" href="mailto:' + esc(p.email) + '">' + ICO.correo + 'Correo</a>';
    if (p.direccion) b += '<a class="btn mini sec" href="' + esc(hrefMapa(p.direccion)) + '" target="_blank" rel="noopener">' + ICO.mapa + 'Mapa</a>';
    if (p.web) b += '<a class="btn mini sec" href="' + esc(hrefWeb(p.web)) + '" target="_blank" rel="noopener">' + ICO.web + 'Web</a>';
    return '<div class="tarjeta prov' + (p.activo ? '' : ' inactivo') + '">' +
      '<div class="prov-cab"><div class="nom"><b>' + esc(p.empresa) + '</b>' +
      (p.contacto || !p.activo ? '<small>' + esc([p.contacto && 'Contacto: ' + p.contacto, !p.activo && 'desactivado'].filter(Boolean).join(' · ')) + '</small>' : '') + '</div>' +
      '<div class="acc"><button class="p-editar" data-id="' + esc(p.id) + '" aria-label="Editar">' + ICO.editar + '</button>' +
      '<button class="p-borrar" data-id="' + esc(p.id) + '" aria-label="Borrar">' + ICO.borrar + '</button></div></div>' +
      (b ? '<div class="prov-btns">' + b + '</div>' : '') +
      (p.email ? '<p class="prov-linea">' + esc(p.email) + '</p>' : '') +
      (p.direccion ? '<p class="prov-linea">' + esc(p.direccion) + '</p>' : '') +
      (p.notas ? '<p class="prov-nota">' + conTelefonos(p.notas) + '</p>' : '') + '</div>';
  }
  function pintarProveedores() {
    var F = S.prov, todos = proveedores();
    var inactivos = todos.filter(function (p) { return !p.activo; }).length;
    var vis = todos.filter(function (p) {
      return (p.activo || F.inactivos) && coincideProv(p, F.texto);
    });
    var grupos = [];
    vis.forEach(function (p) {
      var g = grupos.filter(function (x) { return x.servicio === p.servicio; })[0];
      if (!g) grupos.push(g = { servicio: p.servicio, items: [] });
      g.items.push(p);
    });
    var buscando = !!F.texto;
    vista.innerHTML =
      '<div class="buscador">' + ICO.buscar + '<input class="entrada" id="pTexto" type="search" placeholder="Buscar empresa, servicio o teléfono…" value="' + esc(F.texto) + '"></div>' +
      (inactivos ? '<div class="resumen"><label class="sub check"><input type="checkbox" id="pInact"' + (F.inactivos ? ' checked' : '') + '> Ver desactivados (' + inactivos + ')</label></div>' : '') +
      (grupos.length ? '<div class="grupos-prov">' + grupos.map(function (g) {
        var abierto = buscando || F.abiertos[g.servicio];
        return '<details class="grupo-prov" data-serv="' + esc(g.servicio) + '"' + (abierto ? ' open' : '') + '><summary><span>' + esc(g.servicio) + '</span><small>' + g.items.length + '</small></summary>' +
          '<div class="grupo-cuerpo">' + g.items.map(fichaProveedor).join('') + '</div></details>';
      }).join('') + '</div>'
        : '<div class="vacio">' + (todos.length ? 'Ningún proveedor coincide con la búsqueda.' : 'Todavía no hay proveedores apuntados.') + '</div>') +
      '<button class="btn sec ancho" id="pAnadir" style="margin:6px 0 14px">+ Añadir proveedor</button>';
    var tTexto;
    $('#pTexto').oninput = function () {
      var v = this.value; clearTimeout(tTexto);
      tTexto = setTimeout(function () { S.prov.texto = v; pintarProveedores(); var i = $('#pTexto'); i.focus(); i.setSelectionRange(v.length, v.length); }, 250);
    };
    $$('.grupo-prov').forEach(function (d) {
      d.addEventListener('toggle', function () { if (!S.prov.texto) S.prov.abiertos[d.dataset.serv] = d.open; });
    });
    if ($('#pInact')) $('#pInact').onchange = function () { S.prov.inactivos = this.checked; pintarProveedores(); };
    $('#pAnadir').onclick = function () { editarProveedor(null); };
    $$('.p-editar').forEach(function (b) { b.onclick = function () { editarProveedor(b.dataset.id); }; });
    $$('.p-borrar').forEach(function (b) { b.onclick = function () { borrarProveedor(b.dataset.id); }; });
  }
  function editarProveedor(id) {
    var p = id ? proveedor(id) : { servicio: '', empresa: '', contacto: '', tel1: '', tel2: '', email: '', direccion: '', web: '', notas: '', activo: true };
    if (id && !p) return;
    var campo = function (k, et, max, extra) {
      return '<label class="campo"><span>' + et + '</span><input class="entrada" id="v_' + k + '" maxlength="' + max + '" value="' + esc(p[k]) + '"' + (extra || '') + '></label>';
    };
    modal('<h2>' + (id ? 'Editar proveedor' : 'Nuevo proveedor') + '</h2>' +
      campo('servicio', 'Servicio *', 60, ' list="v_servicios" placeholder="Ej.: Fontanería"') +
      '<datalist id="v_servicios">' + servicios().map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' +
      campo('empresa', 'Empresa o persona *', 100, ' placeholder="Ej.: Instalaciones Fuvisa"') +
      campo('contacto', 'Persona de contacto', 80, ' placeholder="Ej.: María"') +
      '<div class="dos">' + campo('tel1', 'Teléfono 1', 30, ' type="tel" inputmode="tel"') + campo('tel2', 'Teléfono 2', 30, ' type="tel" inputmode="tel"') + '</div>' +
      campo('email', 'Correo electrónico', 100, ' type="email" inputmode="email" autocapitalize="off"') +
      campo('direccion', 'Dirección', 200, ' placeholder="Calle, número, código postal y localidad"') +
      campo('web', 'Página web', 120, ' inputmode="url" autocapitalize="off" placeholder="Ej.: empresa.es"') +
      '<label class="campo"><span>Notas</span><textarea class="entrada" id="v_notas" maxlength="1000" placeholder="Horarios, a quién preguntar, otros teléfonos…">' + esc(p.notas) + '</textarea></label>' +
      '<label class="check"><input type="checkbox" id="v_activo"' + (p.activo ? ' checked' : '') + '> Activo (aparece en la agenda)</label>' +
      '<p class="error-txt" id="vError"></p>' +
      '<div class="fila-btns"><button class="btn borde" data-r="0">Cancelar</button><button class="btn" data-r="1">Guardar</button></div>',
      function (ev, cerrar) {
        var b = ev.target.closest('[data-r]'); if (!b) return;
        if (b.dataset.r === '0') return cerrar();
        var d = { id: id || '', activo: $('#v_activo').checked };
        ['servicio', 'empresa', 'contacto', 'tel1', 'tel2', 'email', 'direccion', 'web', 'notas'].forEach(function (k) { d[k] = $('#v_' + k).value.trim(); });
        if (!d.servicio) { $('#vError').textContent = 'Escribe el servicio (ej.: Fontanería).'; return; }
        if (!d.empresa) { $('#vError').textContent = 'Escribe el nombre de la empresa o persona.'; return; }
        guardar('guardarProveedor', { proveedor: d }, 'Guardado').then(function () { S.prov.abiertos[d.servicio] = true; cerrar(); pintarProveedores(); },
          function (err) { if ($('#vError')) $('#vError').textContent = err.message; });
      });
    setTimeout(function () { var i = $(id ? '#v_empresa' : '#v_servicio'); i && i.focus(); }, 50);
  }
  function borrarProveedor(id) {
    var p = proveedor(id); if (!p) return;
    confirmar('¿Borrar a «' + esc(p.empresa) + '» de la agenda? Se perderán sus datos. Si solo ya no se usa, mejor edítalo y quita «Activo».', 'Borrar', true).then(function (ok) {
      if (!ok) return;
      guardar('borrarProveedor', { id: id }, 'Borrado').then(function () { pintarProveedores(); }, function () {});
    });
  }

  // ---------------- Ajustes ----------------
  function htmlLista(k) {
    var L = LISTAS[k], items = lista(k);
    return '<details class="tarjeta lista-ed" data-lista="' + k + '"' + (S.abierta === k ? ' open' : '') + '><summary>' + L.titulo + '<small>' + items.length + '</small></summary>' +
      (k === 'espacios' ? '<p class="sub" style="margin:0 0 6px">El <b>código</b> servirá para identificar cada estancia (sistema pendiente de decidir).</p>' : '') +
      (k === 'responsables' ? '<p class="sub" style="margin:0 0 6px">Quién puede entrar en la app (aparece en «¿Quién eres?») y a quién se asignan tareas.</p>' : '') +
      (items.length ? items.map(function (e) {
        var extra = [e.codigo && 'Código ' + e.codigo, e.zona, !e.activo && 'desactivado'].filter(Boolean).join(' · ');
        return '<div class="item' + (e.activo ? '' : ' inactivo') + '"><div class="nom"><b>' + esc(e.nombre) + '</b>' + (extra ? '<small>' + esc(extra) + '</small>' : '') + '</div>' +
          '<div class="acc"><button class="b-editar" data-id="' + esc(e.id) + '" aria-label="Editar">' + ICO.editar + '</button>' +
          '<button class="b-borrar" data-id="' + esc(e.id) + '" aria-label="Borrar">' + ICO.borrar + '</button></div></div>';
      }).join('') : '<p class="sub">Todavía no hay ninguno.</p>') +
      '<button class="btn sec ancho b-anadir" style="margin-top:10px">+ Añadir ' + L.uno + '</button></details>';
  }
  function editarElemento(k, id) {
    var L = LISTAS[k], e = id ? elemento(k, id) : { nombre: '', codigo: '', zona: '', activo: true };
    modal('<h2>' + (id ? 'Editar ' : 'Nuevo ') + L.uno + '</h2>' +
      '<label class="campo"><span>Nombre *</span><input class="entrada" id="eNombre" maxlength="80" value="' + esc(e.nombre) + '"></label>' +
      (L.extra ? '<div class="dos"><label class="campo"><span>Código</span><input class="entrada" id="eCodigo" maxlength="40" placeholder="Ej.: P1-12" value="' + esc(e.codigo) + '"></label>' +
        '<label class="campo"><span>Zona / planta</span><input class="entrada" id="eZona" maxlength="40" placeholder="Ej.: Planta 1" value="' + esc(e.zona) + '"></label></div>' : '') +
      '<label class="check"><input type="checkbox" id="eActivo"' + (e.activo ? ' checked' : '') + '> Activo (aparece al apuntar necesidades)</label>' +
      '<p class="error-txt" id="eError"></p>' +
      '<div class="fila-btns"><button class="btn borde" data-r="0">Cancelar</button><button class="btn" data-r="1">Guardar</button></div>',
      function (ev, cerrar) {
        var b = ev.target.closest('[data-r]'); if (!b) return;
        if (b.dataset.r === '0') return cerrar();
        var el = { id: id || '', nombre: $('#eNombre').value.trim(), activo: $('#eActivo').checked };
        if (L.extra) { el.codigo = $('#eCodigo').value.trim(); el.zona = $('#eZona').value.trim(); }
        if (!el.nombre) { $('#eError').textContent = 'Escribe el nombre.'; return; }
        var antes = id ? elemento(k, id) : null;
        guardar('guardarElemento', { lista: k, elemento: el }, 'Guardado').then(function () {
          if (k === 'responsables' && antes && antes.nombre === S.quien && el.nombre !== S.quien) { S.quien = el.nombre; lsSet('quien', el.nombre); }
          cerrar(); S.abierta = k; pintarAjustes();
        },
          function (err) { if ($('#eError')) $('#eError').textContent = err.message; });
      });
    setTimeout(function () { $('#eNombre') && $('#eNombre').focus(); }, 50);
  }
  function borrarElemento(k, id) {
    var e = elemento(k, id); if (!e) return;
    confirmar('¿Borrar «' + esc(e.nombre) + '» de ' + LISTAS[k].titulo.toLowerCase() + '?', 'Borrar', true).then(function (ok) {
      if (!ok) return;
      guardar('borrarElemento', { lista: k, id: id }, 'Borrado').then(function () { S.abierta = k; pintarAjustes(); }, function (err) {
        if (err.codigo !== 'EN_USO') return;
        confirmar(esc(err.message), 'Desactivar').then(function (ok2) {
          if (!ok2) return;
          var el = { id: id, nombre: e.nombre, codigo: e.codigo, zona: e.zona, activo: false };
          guardar('guardarElemento', { lista: k, elemento: el }, 'Desactivado').then(function () { S.abierta = k; pintarAjustes(); }, function () {});
        });
      });
    });
  }
  function pintarAjustes() {
    var aj = S.datos.ajustes || {};
    vista.innerHTML =
      '<div class="tarjeta"><h2>Sesión</h2><div class="dato"><span>Tu nombre</span><span><b>' + esc(S.quien) + '</b></span></div>' +
      '<p class="sub" style="margin:10px 0 0">Queda anotado en cada necesidad que apuntes o cambies. Para entrar como otra persona, cierra la sesión.</p></div>' +
      '<h3>Listas</h3>' + Object.keys(LISTAS).map(htmlLista).join('') +
      (DEMO ? '<details class="tarjeta mant"><summary>Demostración</summary><button class="btn borde ancho" id="aReiniciar">Reiniciar demostración</button></details>' : '') +
      '<button class="btn peligro ancho" id="aSalir">Cerrar sesión en este móvil</button>' +
      '<p class="sub" style="text-align:center;font-size:12px;margin-top:18px">App ' + VERSION + ' · Puente ' + esc(aj.version || '—') + (DEMO ? ' · demostración' : '') + '</p>';
    S.abierta = null;
    $$('.lista-ed').forEach(function (d) {
      var k = d.dataset.lista;
      $$('.b-editar', d).forEach(function (b) { b.onclick = function () { editarElemento(k, b.dataset.id); }; });
      $$('.b-borrar', d).forEach(function (b) { b.onclick = function () { borrarElemento(k, b.dataset.id); }; });
      $('.b-anadir', d).onclick = function () { editarElemento(k, null); };
    });
    if ($('#aReiniciar')) $('#aReiniciar').onclick = function () {
      confirmar('Se borrarán los datos de demostración de este dispositivo.', 'Reiniciar', true).then(function (ok) {
        if (!ok) return; window.__GAS_RESET__ && window.__GAS_RESET__(); lsDel('demoIniciada'); lsDel('cache'); lsDel('responsables'); location.reload();
      });
    };
    $('#aSalir').onclick = function () { confirmar('Tendrás que volver a elegir tu nombre y escribir el PIN para entrar.', 'Cerrar sesión', true).then(function (ok) { if (ok) salir(); }); };
  }

  // ---------------- Arranque ----------------
  $('#tituloCasa').textContent = C.NOMBRE_CASA || 'Tareas';
  $('#menu').onclick = function (e) { var b = e.target.closest('button[data-ir]'); if (b) ir(b.dataset.ir); };
  $('#btnRecargar').onclick = function () { recargar(); };
  window.addEventListener('hashchange', pintar);
  // Al volver a la app: actualizar datos sin borrar lo que se esté escribiendo.
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.quien && S.datos) recargar(true); });
  avisoConexion();

  S.quien = lsGet('quien'); S.pin = lsGet('pin');
  if (S.quien && S.pin) {
    var c = lsGet('cache');
    if (c) { S.datos = c.datos; pintar(); }
    recargar(!!c);
  } else pintarLogin();

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
})();
