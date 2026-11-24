/* Tareas y mantenimiento – tareas de la casa, fotos, seguimiento y agenda de proveedores (v1.4.4) */
(function () {
  'use strict';
  var C = window.CONFIG || {};
  var DEMO = !C.API_URL;
  var VERSION = '1.4.4';
  var S = { pin: null, quien: null, datos: null, sinConexion: false,
            f: { estado: 'abiertas', cat: '', esp: '', resp: '', agrupar: 'importancia', texto: '', soloUrg: false },
            gruposLista: {}, detEdit: null, textoHechas: '',
            prov: { texto: '', inactivos: false, abiertos: {} },
            fotosF: 'sin', seg: {}, borrador: {}, nuevasFotos: [], driveNoVa: false };
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
    galeria: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
    copiar: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  };

  // ---------------- Almacenamiento local (con protección) ----------------
  function lsGet(k) { try { return JSON.parse(localStorage.getItem('nec:' + k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem('nec:' + k, JSON.stringify(v)); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem('nec:' + k); } catch (e) {} }
  function ssGet(k) { try { return sessionStorage.getItem('nec:' + k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem('nec:' + k, String(v)); } catch (e) {} }
  function ssDel(k) { try { sessionStorage.removeItem('nec:' + k); } catch (e) {} }

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

  function editando() {
    var v = ruta().vista;
    return v === 'nueva' || v === 'editar' || (v === 'tarea' && S.detEdit && S.detEdit.sucio);
  }

  /** Recarga datos. Si se está escribiendo una tarea NO se redibuja (para no perder lo escrito). */
  function recargar(silencioso) {
    if (!silencioso) cargando(true);
    return api('inicial').then(function () { if (!abrirTareaPendiente() && !editando() && $('#modal').hidden) pintar(); })
      .catch(function (e) {
        if (e.codigo === 'CLAVE') return salir('El PIN ha cambiado. Vuelve a entrar.');
        if (e.codigo === 'PERSONA' || e.codigo === 'SIN_PIN') return salir(e.message);
        var c = lsGet('cache');
        if (e.red && c) { S.datos = c.datos; S.sinConexion = true; avisoConexion(); if (!abrirTareaPendiente() && !editando()) pintar(); }
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
  function esNuevaMia(t) { return !!(S.quien && t.estado !== 'Hecha' && t.responsable === S.quien && t.aviso); }
  function nuevasMias() { return tareas().filter(esNuevaMia); }
  function textoAvisoAsignadas(lista) {
    var por = [];
    lista.forEach(function (t) { if (t.aviso && por.indexOf(t.aviso) < 0) por.push(t.aviso); });
    var quienes = !por.length ? 'Alguien' : por.length === 1 ? '<b>' + esc(por[0]) + '</b>' :
      por.slice(0, -1).map(function (x) { return '<b>' + esc(x) + '</b>'; }).join(', ') + ' y <b>' + esc(por[por.length - 1]) + '</b>';
    var verbo = por.length > 1 ? ' te han asignado ' : ' te ha asignado ';
    var n = lista.length;
    return quienes + verbo + '<b>' + n + ' tarea' + (n === 1 ? ' nueva' : 's nuevas') + '</b>';
  }
  function actualizarGlobo() {
    var g = $('#numNuevas'); if (!g) return;
    var n = nuevasMias().length;
    g.textContent = n ? String(n) : '';
    g.hidden = !n;
  }
  function esRecordatorioWa(t) { return !!(t && t.responsable && t.avisoPara === t.responsable); }
  function enlaceTarea(id) { return location.origin + location.pathname + '?tarea=' + encodeURIComponent(id); }
  function textoWa(t) {
    return (esRecordatorioWa(t) ? 'Recordatorio: tienes una tarea pendiente: ' : 'Te han asignado una tarea: ') + enlaceTarea(t.id);
  }
  function mostrarWa(t) { return !!(t && t.responsable && t.responsable !== S.quien); }
  function htmlBloqueWa(t) {
    if (!mostrarWa(t)) return '';
    var et = esRecordatorioWa(t) ? 'Copiar recordatorio para WhatsApp' : 'Copiar enlace para WhatsApp';
    return '<div class="aviso-wa"><button type="button" class="btn sec ancho" data-copiar-wa="' + esc(t.id) + '">' + ICO.copiar + esc(et) + '</button>' +
      '<p class="pie-wa">Pégalo en WhatsApp y envíaselo a <b>' + esc(t.responsable) + '</b>.</p></div>';
  }
  function copiarRespaldo(texto) {
    try {
      var ta = document.createElement('textarea');
      ta.value = texto;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, texto.length);
      var ok = document.execCommand('copy');
      ta.remove();
      return !!ok;
    } catch (e) { return false; }
  }
  function copiarPortapapeles(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(texto).then(function () { return true; }, function () { return copiarRespaldo(texto); });
    }
    return Promise.resolve(copiarRespaldo(texto));
  }
  function copiarAvisoWa(tid) {
    var t = tarea(tid); if (!t) return;
    var txt = textoWa(t);
    // 1.º Copiar dentro del mismo toque (compatible con iPhone/Safari y Android)
    copiarPortapapeles(txt).then(function () {
      toast('Texto copiado');
      // 2.º Registrar en la hoja
      if (S.sinConexion) {
        setTimeout(function () { toast('Copiado, pero no se pudo anotar (sin conexión)'); }, 1200);
        return;
      }
      api('registrarAviso', { tareaId: t.id }).then(function () {
        if (!editando() && $('#modal').hidden) pintar();
        else {
          var tAct = tarea(t.id);
          if (tAct) $$('[data-copiar-wa="' + t.id + '"]').forEach(function (b) {
            b.innerHTML = ICO.copiar + esc(esRecordatorioWa(tAct) ? 'Copiar recordatorio para WhatsApp' : 'Copiar enlace para WhatsApp');
          });
        }
      }).catch(function () {
        toast('Copiado, pero no se pudo anotar (sin conexión)');
      });
    });
  }
  function enlazarWa(el) {
    $$('[data-copiar-wa]', el || document).forEach(function (b) {
      b.onclick = function () { copiarAvisoWa(b.dataset.copiarWa); };
    });
  }
  function modalAvisoGuardado(tid, alCerrar) {
    var t = tarea(tid);
    if (!t || !mostrarWa(t)) { if (alCerrar) alCerrar(); return; }
    modal('<h2>Tarea asignada a ' + esc(t.responsable) + '</h2>' +
      '<p class="sub" style="margin:0 0 12px"><b>' + esc(t.titulo) + '</b></p>' +
      htmlBloqueWa(t) +
      '<div class="fila-btns" style="margin-top:14px"><button class="btn borde ancho" data-r="0">Listo</button></div>',
      function (ev, cerrar) {
        var b = ev.target.closest('[data-r]');
        if (b && b.dataset.r === '0') { cerrar(); if (alCerrar) alCerrar(); }
      });
    enlazarWa($('#modal'));
    $('#modal').addEventListener('click', function f(e) {
      if (e.target === this) { this.removeEventListener('click', f); if (alCerrar) alCerrar(); }
    });
  }
  function abrirTareaPendiente() {
    var tid = ssGet('tareaEnlace');
    if (!tid || !S.datos) return false;
    ssDel('tareaEnlace');
    if (tarea(tid)) {
      ir('tarea/' + encodeURIComponent(tid));
    } else {
      toast('Esta tarea ya no existe', true);
      ir('lista');
    }
    return true;
  }

  // ---------------- Navegación ----------------
  var TITULOS = { lista: 'Pendientes', nueva: 'Nueva tarea', editar: 'Tarea', tarea: 'Tarea', hechas: 'Hechas', fotos: 'Fotos', proveedores: 'Proveedores', ajustes: 'Ajustes' };
  function ruta() {
    var h = location.hash.replace(/^#\/?/, '');
    var seg = h.split('?')[0].split('/');
    return { vista: seg[0] || 'lista', id: seg[1] ? decodeURIComponent(seg[1]) : null };
  }
  function comprobarSalirDetalle() {
    if (S.detEdit && S.detEdit.sucio) {
      return confirmar('Tienes cambios sin guardar en esta tarea. ¿Salir y descartarlos?', 'Descartar y salir', true).then(function (ok) {
        if (ok) S.detEdit = null;
        return ok;
      });
    }
    return Promise.resolve(true);
  }
  function ir(h) {
    comprobarSalirDetalle().then(function (ok) {
      if (!ok) return;
      if (location.hash === '#/' + h) pintar(); else location.hash = '/' + h;
    });
  }
  var historial = 0;
  window.addEventListener('hashchange', function () { historial++; });
  function volver() {
    comprobarSalirDetalle().then(function (ok) {
      if (!ok) return;
      if (historial > 0 && history.length > 1) history.back(); else { if (location.hash === '#/lista') pintar(); else location.hash = '/lista'; }
    });
  }
  function botonVolver() { return '<button class="volver" id="bVolver"><span>‹</span> Volver</button>'; }
  function enlazarVolver() { var b = $('#bVolver'); if (b) b.onclick = volver; }

  function pintar() {
    if (!S.quien) return pintarLogin();
    if (!S.datos) return;
    var r = ruta();
    if (r.vista === 'editar' && r.id) {
      history.replaceState(null, '', location.pathname + '#/tarea/' + encodeURIComponent(r.id));
      r = ruta();
    }
    if (r.vista !== 'tarea' || (S.detEdit && S.detEdit.id !== r.id)) {
      if (S.detEdit && S.detEdit.sucio && S.rutaPintada && S.rutaPintada !== location.hash) {
        var hashPrevio = S.rutaPintada;
        history.replaceState(null, '', location.pathname + hashPrevio);
        comprobarSalirDetalle().then(function (ok) {
          if (ok) { location.hash = '/' + r.vista + (r.id ? '/' + encodeURIComponent(r.id) : ''); }
        });
        return;
      }
      if (r.vista !== 'tarea') S.detEdit = null;
    }
    $('#menu').hidden = false; $('#btnRecargar').hidden = false;
    if ($('#btnImprimir')) $('#btnImprimir').hidden = r.vista !== 'lista';
    actualizarGlobo();
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
    if ($('#btnImprimir')) $('#btnImprimir').hidden = true;
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
        if (abrirTareaPendiente()) return;
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
  function etiquetas(t, conCat) {
    var e = '';
    if (esNuevaMia(t)) e += '<span class="etiqueta nueva">Nueva</span>';
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
    var c = clasePrio(t);
    var urg = t.urgente && t.estado !== 'Hecha';
    return '<button class="tarea ' + c + '" data-id="' + esc(t.id) + '">' +
      '<div class="info"><div class="tarea-tit"><span class="punto-prio ' + c + '" aria-hidden="true"></span>' +
      (urg ? '<span class="ic-urg" aria-label="Urgente">⚠️</span>' : '') +
      '<b>' + esc(t.titulo) + '</b></div>' +
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
  function opcionesResponsableFiltro(sel, abiertas) {
    var miasCount = abiertas.filter(function (t) { return t.responsable === S.quien; }).length;
    var nuevasCount = nuevasMias().length;
    var etYo = 'Yo (' + S.quien + ')' + (miasCount ? ' · ' + miasCount : '') + (nuevasCount ? ' (' + nuevasCount + (nuevasCount === 1 ? ' nueva)' : ' nuevas)') : '');
    var otros = lista('responsables').filter(function (r) { return (r.activo || r.nombre === sel) && r.nombre !== S.quien; });
    return '<option value="">Responsable: Todos</option>' +
      (S.quien ? '<option value="__yo__"' + (sel === '__yo__' ? ' selected' : '') + '>' + esc(etYo) + '</option>' : '') +
      otros.map(function (r) { return '<option value="' + esc(r.nombre) + '"' + (sel === r.nombre ? ' selected' : '') + '>' + esc(r.nombre) + '</option>'; }).join('') +
      '<option value="__sin__"' + (sel === '__sin__' ? ' selected' : '') + '>Sin asignar</option>';
  }
  function opcionesAgrupar(sel) {
    return CRITERIOS_PDF.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === sel ? ' selected' : '') + '>Agrupar por: ' + esc(c.nombre) + '</option>';
    }).join('');
  }
  function coincideResp(t, fResp) {
    if (!fResp) return true;
    if (fResp === '__yo__') return t.responsable === S.quien;
    if (fResp === '__sin__') return !t.responsable;
    return t.responsable === fResp;
  }
  function coincide(t, texto) {
    if (!texto) return true;
    var q = sinAcentos(texto);
    return sinAcentos([t.titulo, t.descripcion, t.notas, t.lugar, nombreEspacio(t), codigoEspacio(t), nombreCategoria(t), t.responsable].join(' ')).indexOf(q) >= 0;
  }
  function tareasVisiblesLista() {
    var f = S.f;
    var abiertas = tareas().filter(function (t) { return t.estado !== 'Hecha'; });
    var base = abiertas.filter(function (t) {
      return (!f.cat || t.categoriaId === f.cat) && (!f.esp || t.espacioId === f.esp) && (!f.soloUrg || t.urgente) && coincideResp(t, f.resp) && coincide(t, f.texto);
    });
    return ordenar(base.filter(function (t) { return f.estado === 'abiertas' || t.estado === f.estado; }));
  }
  function estadoGruposLista(criterio) {
    var todo = lsGet('gruposLista') || {};
    return todo[criterio] || {};
  }
  function guardarEstadoGrupoLista(criterio, clave, abierto) {
    var todo = lsGet('gruposLista') || {};
    todo[criterio] = todo[criterio] || {};
    todo[criterio][clave] = !!abierto;
    lsSet('gruposLista', todo);
  }
  function htmlGruposLista(visibles, criterio, buscando) {
    var mem = estadoGruposLista(criterio);
    return '<div class="grupos-lista">' + agruparParaPdf(visibles, criterio).map(function (g) {
      var tit = g.tituloLista || g.titulo;
      var clave = g.titulo;
      var abierto = buscando ? true : (mem[clave] != null ? mem[clave] : true);
      return '<details class="grupo-lista' + (g.clase ? ' ' + g.clase : '') + '" data-gclave="' + esc(clave) + '"' + (abierto ? ' open' : '') + '>' +
        '<summary><span>' + esc(tit) + '</span><small>' + g.items.length + '</small></summary>' +
        '<div class="grupo-lista-cuerpo">' + g.items.map(tarjeta).join('') + '</div></details>';
    }).join('') + '</div>';
  }
  function pintarLista() {
    var f = S.f;
    var agrGuardado = lsGet('agruparLista');
    if (agrGuardado && CRITERIOS_PDF.some(function (c) { return c.id === agrGuardado; })) f.agrupar = agrGuardado;
    var abiertas = tareas().filter(function (t) { return t.estado !== 'Hecha'; });
    var nuevas = nuevasMias();
    var base = abiertas.filter(function (t) {
      return (!f.cat || t.categoriaId === f.cat) && (!f.esp || t.espacioId === f.esp) && (!f.soloUrg || t.urgente) && coincideResp(t, f.resp) && coincide(t, f.texto);
    });
    var cuenta = function (e) { return base.filter(function (t) { return e === 'abiertas' || t.estado === e; }).length; };
    var visibles = ordenar(base.filter(function (t) { return f.estado === 'abiertas' || t.estado === f.estado; }));
    var hayFiltro = f.cat || f.esp || f.resp || f.soloUrg || f.texto;
    var viendoMias = f.resp === '__yo__';
    vista.innerHTML =
      (nuevas.length ? '<button class="aviso-asig" id="fAvisoAsig"><span>' + textoAvisoAsignadas(nuevas) + '</span><small>' + (viendoMias ? 'Viendo mis tareas' : 'Ver mis tareas') + '</small></button>' : '') +
      '<div class="buscador">' + ICO.buscar + '<input class="entrada" id="fTexto" type="search" placeholder="Buscar…" value="' + esc(f.texto) + '"></div>' +
      '<div class="segmento cuatro" id="fEstado">' +
      [['abiertas', 'Todas'], ['Pendiente', 'Pendientes'], ['En curso', 'En curso'], ['Esperando', 'Esperando']].map(function (x) {
        return '<button data-e="' + x[0] + '" class="' + (f.estado === x[0] ? 'activo' : '') + '">' + x[1] + '<small>' + cuenta(x[0]) + '</small></button>';
      }).join('') + '</div>' +
      '<div class="filtros"><select class="entrada' + (f.esp ? ' activo' : '') + '" id="fEsp">' + opciones('espacios', f.esp, 'Todos los espacios') + '</select>' +
      '<select class="entrada' + (f.cat ? ' activo' : '') + '" id="fCat">' + opciones('categorias', f.cat, 'Todas las categorías') + '</select>' +
      '<select class="entrada' + (f.resp ? ' activo' : '') + '" id="fResp">' + opcionesResponsableFiltro(f.resp, abiertas) + '</select>' +
      '<select class="entrada' + (f.agrupar !== 'importancia' ? ' activo' : '') + '" id="fAgrupar">' + opcionesAgrupar(f.agrupar || 'importancia') + '</select></div>' +
      '<div class="resumen"><div class="resumen-checks"><label class="sub check"><input type="checkbox" id="fUrg"' + (f.soloUrg ? ' checked' : '') + '> Solo urgentes</label></div>' +
      (hayFiltro ? '<button class="limpiar" id="fLimpiar">Quitar filtros</button>' : '') + '</div>' +
      (visibles.length ? htmlGruposLista(visibles, f.agrupar || 'importancia', !!f.texto)
        : '<div class="vacio">' + (abiertas.length ? 'Nada con estos filtros.' : '¡Todo al día! No hay tareas pendientes.') + '</div>');
    var tTexto;
    if ($('#fAvisoAsig')) $('#fAvisoAsig').onclick = function () {
      if (nuevas.length === 1) ir('tarea/' + encodeURIComponent(nuevas[0].id));
      else { S.f.resp = '__yo__'; S.f.estado = 'abiertas'; pintarLista(); }
    };
    $('#fTexto').oninput = function () {
      var v = this.value; clearTimeout(tTexto);
      tTexto = setTimeout(function () { S.f.texto = v; pintarLista(); var i = $('#fTexto'); i.focus(); i.setSelectionRange(v.length, v.length); }, 250);
    };
    $('#fEstado').onclick = function (e) { var b = e.target.closest('button'); if (b) { S.f.estado = b.dataset.e; pintarLista(); } };
    $('#fEsp').onchange = function () { S.f.esp = this.value; pintarLista(); };
    $('#fCat').onchange = function () { S.f.cat = this.value; pintarLista(); };
    $('#fResp').onchange = function () { S.f.resp = this.value; pintarLista(); };
    $('#fAgrupar').onchange = function () { S.f.agrupar = this.value; lsSet('agruparLista', this.value); pintarLista(); };
    $('#fUrg').onchange = function () { S.f.soloUrg = this.checked; pintarLista(); };
    if ($('#fLimpiar')) $('#fLimpiar').onclick = function () { S.f = { estado: S.f.estado, cat: '', esp: '', resp: '', agrupar: S.f.agrupar || 'importancia', texto: '', soloUrg: false }; pintarLista(); };
    $$('details.grupo-lista', vista).forEach(function (d) {
      d.addEventListener('toggle', function () {
        if (!S.f.texto) guardarEstadoGrupoLista(S.f.agrupar || 'importancia', d.dataset.gclave, d.open);
      });
    });
    enlazarTarjetas();
  }

  // ---------------- Hechas (historial) ----------------
  function pintarHechas() {
    var lista_ = tareas().filter(function (t) { return t.estado === 'Hecha' && coincide(t, S.textoHechas); })
      .sort(function (a, b) { return String(b.hechaEl).localeCompare(String(a.hechaEl)); });
    vista.innerHTML =
      '<div class="buscador">' + ICO.buscar + '<input class="entrada" id="hTexto" type="search" placeholder="Buscar en hechas…" value="' + esc(S.textoHechas) + '"></div>' +
      '<p class="sub" style="margin:0 0 8px">' + lista_.length + ' tarea' + (lista_.length === 1 ? '' : 's') + ' resuelta' + (lista_.length === 1 ? '' : 's') + ', de la más reciente a la más antigua.</p>' +
      (lista_.length ? lista_.map(tarjeta).join('') : '<div class="vacio">Aún no hay nada marcado como hecho.</div>');
    var tTexto;
    $('#hTexto').oninput = function () {
      var v = this.value; clearTimeout(tTexto);
      tTexto = setTimeout(function () { S.textoHechas = v; pintarHechas(); var i = $('#hTexto'); i.focus(); i.setSelectionRange(v.length, v.length); }, 250);
    };
    enlazarTarjetas();
  }

  // ---------------- Detalle (vista única editable, D25) ----------------
  function diferenciasTarea(orig, bor) {
    var campos = ['titulo', 'espacioId', 'lugar', 'categoriaId', 'prioridad', 'responsable', 'limite', 'descripcion', 'notas'];
    if (!!orig.urgente !== !!bor.urgente) return true;
    return campos.some(function (k) { return String(orig[k] || '').trim() !== String(bor[k] || '').trim(); });
  }
  function pintarDetalle(id) {
    var t = tarea(id);
    if (!t) { S.detEdit = null; vista.innerHTML = botonVolver() + '<div class="vacio">Esta tarea ya no existe.</div>'; return enlazarVolver(); }
    if (esNuevaMia(t) && !S.sinConexion) {
      t.aviso = '';
      actualizarGlobo();
      api('vistoTarea', { id: t.id }).catch(function () {});
    }
    if (!S.detEdit || S.detEdit.id !== t.id || !S.detEdit.sucio) {
      S.detEdit = { id: t.id, v: JSON.parse(JSON.stringify(t)), campo: (S.detEdit && S.detEdit.id === t.id) ? S.detEdit.campo : null, sucio: false };
    }
    var ed = S.detEdit, v = ed.v, campo = ed.campo;
    ed.sucio = diferenciasTarea(t, v);
    var respList = lista('responsables').filter(function (r) { return r.activo || r.nombre === v.responsable; }).map(function (r) { return r.nombre; });
    if (v.responsable && respList.indexOf(v.responsable) < 0) respList.push(v.responsable);

    var nomEsp = (function () {
      var e = elemento('espacios', v.espacioId);
      return e ? ((e.codigo ? e.codigo + ' · ' : '') + e.nombre) : (v.espacio || '');
    })();
    var nomCat = (function () {
      var c = elemento('categorias', v.categoriaId);
      return c ? c.nombre : (v.categoria || '');
    })();
    var filaEditable = function (clave, et, valorHtml, vacioTxt, editorHtml) {
      if (campo === clave) {
        return '<div class="dato editable editando-campo" data-ed="' + clave + '"><span>' + et + '</span>' + editorHtml + '</div>';
      }
      var tiene = !!valorHtml;
      return '<div class="dato editable" data-ed="' + clave + '"><span>' + et + '</span>' +
        '<span class="val' + (tiene ? '' : ' vacio-val') + '">' + (tiene ? valorHtml : esc(vacioTxt)) + ' <small class="lapiz">✎</small></span></div>';
    };

    vista.innerHTML = botonVolver() +
      '<div class="tarjeta det ' + clasePrio(v) + '"><div class="det-cab">' +
      (campo === 'titulo'
        ? '<input class="entrada det-tit-in" id="ed_titulo" maxlength="150" value="' + esc(v.titulo) + '">'
        : '<button type="button" class="det-tit-btn" data-ed="titulo"><span>' + esc(v.titulo) + '</span><small>✎</small></button>') +
      '<div class="det-acc"><button class="btn peligro discreto" id="dBorrar">' + ICO.borrar + 'Borrar</button></div></div>' +
      etiquetas(v, false) +
      '<div style="margin-top:10px">' +
      filaEditable('espacioId', 'Espacio', esc(nomEsp), 'Sin espacio',
        '<select class="in-linea" id="ed_espacioId">' + opciones('espacios', v.espacioId, '— Sin espacio —') + '</select>') +
      filaEditable('lugar', 'Lugar exacto', esc(v.lugar), 'Añadir lugar…',
        '<input class="in-linea" id="ed_lugar" maxlength="120" placeholder="Ej.: Hab. 12" value="' + esc(v.lugar) + '">') +
      filaEditable('categoriaId', 'Categoría', esc(nomCat), 'Sin categoría',
        '<select class="in-linea" id="ed_categoriaId">' + opciones('categorias', v.categoriaId, '— Sin categoría —') + '</select>') +
      (campo === 'prioridad'
        ? '<div class="prio-inline" data-ed="prioridad"><span style="font-size:13px;color:var(--texto-2);font-weight:600">Prioridad y urgencia</span>' +
          '<div class="fila-prio"><div class="segmento tres prioridad" id="ed_prio">' +
          PRIORIDADES.map(function (p) { return '<button type="button" data-p="' + p + '" class="p-' + p.toLowerCase() + (v.prioridad === p ? ' activo' : '') + '">' + p + '</button>'; }).join('') +
          '</div><label class="urg-chip' + (v.urgente ? ' on' : '') + '" id="ed_urgL"><input type="checkbox" id="ed_urg"' + (v.urgente ? ' checked' : '') + '> Urgente</label></div></div>'
        : filaEditable('prioridad', 'Prioridad', esc(v.prioridad) + (v.urgente ? ' · <span style="color:var(--tel)">urgente</span>' : ''), 'Media', '')) +
      filaEditable('responsable', 'Responsable', esc(v.responsable), 'Sin asignar',
        '<select class="in-linea" id="ed_responsable"><option value="">Sin asignar</option>' +
        respList.map(function (n) { return '<option value="' + esc(n) + '"' + (n === v.responsable ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>') +
      filaEditable('limite', 'Fecha límite',
        v.limite ? '<span' + (vencida(v) ? ' style="color:var(--tel)"' : '') + '>' + legible(v.limite) + '</span>' : '', 'Sin fecha',
        '<input class="in-linea" id="ed_limite" type="date" value="' + esc(v.limite) + '">') +
      '</div>' +
      '<div class="bloque-ed" data-ed="descripcion"><h3><span>Descripción</span><small>✎</small></h3>' +
      (campo === 'descripcion'
        ? '<textarea class="entrada" id="ed_descripcion" maxlength="2000" placeholder="Detalles, medidas, material necesario…">' + esc(v.descripcion) + '</textarea>'
        : (v.descripcion ? '<p class="texto-largo">' + esc(v.descripcion) + '</p>' : '<p class="vacio-bloque">Toca para añadir descripción…</p>')) +
      '</div>' +
      '<div class="bloque-ed" data-ed="notas"><h3><span>Notas</span><small>✎</small></h3>' +
      (campo === 'notas'
        ? '<textarea class="entrada" id="ed_notas" maxlength="2000" placeholder="Ej.: Llamado al fontanero el lunes">' + esc(v.notas) + '</textarea>'
        : (v.notas ? '<p class="texto-largo">' + esc(v.notas) + '</p>' : '<p class="vacio-bloque">Toca para añadir notas…</p>')) +
      '</div>' +
      '<p class="error-txt" id="dError"></p>' +
      (!ed.sucio && mostrarWa(t) ? '<div style="margin-top:12px">' + htmlBloqueWa(t) + '</div>' : '') +
      (ed.sucio ? '<div class="pie-cambios" id="dBarraCambios"><button type="button" class="btn borde" id="dDescartar">Descartar</button><button type="button" class="btn" id="dGuardar">Guardar cambios</button></div>' : '') +
      '</div>' +
      '<div class="tarjeta estado-rapido"><h2>Estado</h2><div class="segmento cuatro" id="dEstado">' +
      ESTADOS.map(function (e) { return '<button data-e="' + e + '" class="e-' + claseEstado(e) + (t.estado === e ? ' activo' : '') + '">' + e + '</button>'; }).join('') +
      '</div></div>' +
      bloqueFotosTarea(t) + bloqueSeguimiento(t) +
      '<p class="pie-meta">Apuntada por ' + esc(t.creadoPor || '—') + ' el ' + legible(t.creadoEl) +
      (t.modificadoEl && t.modificadoEl !== t.creadoEl ? '<br>Último cambio: ' + esc(t.modificadoPor) + ', ' + legible(t.modificadoEl) : '') +
      (t.hechaEl ? '<br>Hecha el ' + legible(t.hechaEl) : '') + '</p>';

    enlazarVolver();
    enlazarWa(vista);

    function recogerCampoActivo() {
      if ($('#ed_titulo')) v.titulo = $('#ed_titulo').value;
      if ($('#ed_espacioId')) v.espacioId = $('#ed_espacioId').value;
      if ($('#ed_lugar')) v.lugar = $('#ed_lugar').value;
      if ($('#ed_categoriaId')) v.categoriaId = $('#ed_categoriaId').value;
      if ($('#ed_responsable')) v.responsable = $('#ed_responsable').value;
      if ($('#ed_limite')) v.limite = $('#ed_limite').value;
      if ($('#ed_descripcion')) v.descripcion = $('#ed_descripcion').value;
      if ($('#ed_notas')) v.notas = $('#ed_notas').value;
      ed.sucio = diferenciasTarea(t, v);
    }

    // Abrir un campo al tocarlo
    $$('[data-ed]', vista).forEach(function (el) {
      el.onclick = function (ev) {
        if (ev.target.closest('input, select, textarea, .segmento, .urg-chip')) return;
        recogerCampoActivo();
        var nuevoCampo = el.dataset.ed;
        ed.campo = (ed.campo === nuevoCampo && nuevoCampo === 'prioridad') ? null : nuevoCampo;
        pintarDetalle(t.id);
        setTimeout(function () {
          var inp = $('#ed_' + ed.campo);
          if (inp && inp.focus) {
            inp.focus();
            if (inp.setSelectionRange && inp.type === 'text') inp.setSelectionRange(inp.value.length, inp.value.length);
          }
        }, 20);
      };
    });

    // Eventos del control activo
    ['espacioId', 'categoriaId', 'responsable', 'limite'].forEach(function (k) {
      var sel = $('#ed_' + k);
      if (!sel) return;
      sel.onchange = function () {
        v[k] = this.value;
        ed.campo = null;
        ed.sucio = diferenciasTarea(t, v);
        pintarDetalle(t.id);
      };
      sel.onblur = function () {
        v[k] = this.value;
        ed.campo = null;
        ed.sucio = diferenciasTarea(t, v);
        pintarDetalle(t.id);
      };
    });
    ['titulo', 'lugar', 'descripcion', 'notas'].forEach(function (k) {
      var inp = $('#ed_' + k);
      if (!inp) return;
      inp.oninput = function () {
        v[k] = this.value;
        var antes = ed.sucio;
        ed.sucio = diferenciasTarea(t, v);
        if (antes !== ed.sucio) {
          // Mostrar u ocultar la barra de Guardar/Descartar sin perder el foco
          var pos = this.selectionStart;
          pintarDetalle(t.id);
          var nuevoInp = $('#ed_' + k);
          if (nuevoInp) { nuevoInp.focus(); try { nuevoInp.setSelectionRange(pos, pos); } catch (e) {} }
        }
      };
      if (k === 'titulo' || k === 'lugar') {
        inp.onkeydown = function (ev) {
          if (ev.key === 'Enter') { ev.preventDefault(); v[k] = this.value; ed.campo = null; pintarDetalle(t.id); }
        };
      }
    });
    if ($('#ed_prio')) $('#ed_prio').onclick = function (ev) {
      var b = ev.target.closest('button[data-p]'); if (!b) return;
      v.prioridad = b.dataset.p;
      ed.sucio = diferenciasTarea(t, v);
      pintarDetalle(t.id);
    };
    if ($('#ed_urg')) $('#ed_urg').onchange = function () {
      v.urgente = this.checked;
      ed.sucio = diferenciasTarea(t, v);
      pintarDetalle(t.id);
    };

    if ($('#dDescartar')) $('#dDescartar').onclick = function () {
      S.detEdit = null;
      pintarDetalle(t.id);
    };
    if ($('#dGuardar')) $('#dGuardar').onclick = function () {
      recogerCampoActivo();
      v.titulo = String(v.titulo || '').trim();
      if (!v.titulo) {
        ed.campo = 'titulo';
        pintarDetalle(t.id);
        if ($('#dError')) $('#dError').textContent = 'Escribe el título de la tarea.';
        if ($('#ed_titulo')) $('#ed_titulo').focus();
        return;
      }
      v.lugar = String(v.lugar || '').trim();
      v.descripcion = String(v.descripcion || '').trim();
      v.notas = String(v.notas || '').trim();
      var respAntes = t.responsable || '';
      var pedirWa = !!(v.responsable && v.responsable !== S.quien && v.responsable !== respAntes);
      guardar('guardarTarea', { tarea: v }, 'Cambios guardados').then(function () {
        S.detEdit = null;
        pintarDetalle(t.id);
        if (pedirWa) modalAvisoGuardado(t.id, function () { pintarDetalle(t.id); });
      }, function (e) { if (e && e.message !== 'sin conexión' && $('#dError')) $('#dError').textContent = e.message; });
    };

    $('#dEstado').onclick = function (e) {
      var b = e.target.closest('button'); if (!b || b.dataset.e === t.estado) return;
      recogerCampoActivo();
      guardar('cambiarEstado', { id: t.id, estado: b.dataset.e }, 'Estado: ' + b.dataset.e).then(function () {
        if (S.detEdit && S.detEdit.id === t.id) S.detEdit.v.estado = b.dataset.e;
        pintar();
      }, function () {});
    };
    enlazarSelectorFotosTarea(t);
    enlazarSeguimiento(t);
    enlazarFotos(vista);
    $('#dBorrar').onclick = function () {
      confirmar('¿Borrar «' + esc(t.titulo) + '»? No se puede deshacer. Si ya está resuelta, mejor márcala como <b>Hecha</b> para que quede en el historial.', 'Borrar', true).then(function (ok) {
        if (!ok) return;
        S.detEdit = null;
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
  /** Selector de fotos (D25): solo «Subir desde la galería» (principal) y «Hacer foto», sin «Ya en la app» ni «Del repositorio». */
  function htmlSelectorFotos(pref) {
    return '<div class="sel-fotos-acc">' +
      '<button type="button" class="btn btn-gal-pri" id="' + pref + 'Gal">' + ICO.galeria + 'Subir desde la galería</button>' +
      '<button type="button" class="btn sec mini btn-cam-sec" id="' + pref + 'Cam">' + ICO.camara + 'Hacer foto</button></div>';
  }
  function bloqueFotosTarea(t) {
    var fs = fotosDe(t.id);
    return '<div class="tarjeta"><h2 class="con-num">Fotos<small>' + fs.length + '</small></h2>' +
      (fs.length ? '<div class="tira-fotos">' + fs.map(function (f) { return '<button class="mini-foto" data-ver="' + esc(f.id) + '">' + htmlImg(f.id) + '</button>'; }).join('') + '</div>'
        : '<p class="sub" style="margin:0 0 10px">Sin fotos todavía.</p>') +
      htmlSelectorFotos('dFoto') + '</div>';
  }
  function enlazarSelectorFotosTarea(t) {
    if ($('#dFotoGal')) $('#dFotoGal').onclick = function () {
      elegirArchivos(false, true).then(function (a) { return subirFotos(a, t.id); }).then(function (ids) { if (ids.length) pintar(); });
    };
    if ($('#dFotoCam')) $('#dFotoCam').onclick = function () {
      elegirArchivos(true, false).then(function (a) { return subirFotos(a, t.id); }).then(function (ids) { if (ids.length) pintar(); });
    };
  }

  // ---------------- Seguimiento (avances de cada tarea, plegados por día) ----------------
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var ICO_SEG = { alta: '＋', estado: '⇄', cambio: '✎', foto: '📷', aviso: '💬' };
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

  // ---------------- Formulario (nueva) ----------------
  function pintarFotosFormNueva() {
    var cont = $('#nFotosCont'); if (!cont) return;
    var elegidas = (S.nuevasFotos || []).filter(function (fid) { return foto(fid); });
    S.nuevasFotos = elegidas;
    cont.innerHTML = '<h2 class="con-num">Fotos<small>' + elegidas.length + '</small></h2>' +
      (elegidas.length ? '<div class="tira-fotos" id="nFotosTira">' + elegidas.map(function (fid) {
        return '<span class="mini-foto">' + htmlImg(fid) + '<button type="button" class="quitar" data-quitar-nueva="' + esc(fid) + '" aria-label="Quitar">×</button></span>';
      }).join('') + '</div>' : '<p class="sub" style="margin:0 0 10px">Sin fotos todavía.</p>') +
      htmlSelectorFotos('nFoto');
    $$('[data-quitar-nueva]', cont).forEach(function (b) {
      b.onclick = function () {
        S.nuevasFotos = S.nuevasFotos.filter(function (x) { return x !== b.dataset.quitarNueva; });
        pintarFotosFormNueva();
      };
    });
    if ($('#nFotoGal')) $('#nFotoGal').onclick = function () {
      elegirArchivos(false, true).then(function (a) { return subirFotos(a); }).then(function (ids) {
        if (!ids.length) return;
        ids.forEach(function (fid) { if (S.nuevasFotos.indexOf(fid) < 0) S.nuevasFotos.push(fid); });
        pintarFotosFormNueva();
      });
    };
    if ($('#nFotoCam')) $('#nFotoCam').onclick = function () {
      elegirArchivos(true, false).then(function (a) { return subirFotos(a); }).then(function (ids) {
        if (!ids.length) return;
        ids.forEach(function (fid) { if (S.nuevasFotos.indexOf(fid) < 0) S.nuevasFotos.push(fid); });
        pintarFotosFormNueva();
      });
    };
    activarImagenes(cont);
  }
  function pintarFormulario(id) {
    var t = id ? tarea(id) : null;
    if (id && !t) { vista.innerHTML = botonVolver() + '<div class="vacio">Esta tarea ya no existe.</div>'; return enlazarVolver(); }
    if (!t) S.nuevasFotos = [];
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
      (!t ? '<div class="tarjeta" id="nFotosCont"></div>' : '') +
      '<div class="pie-form"><button class="btn borde" id="nCancelar">Cancelar</button><button class="btn" id="nGuardar">' + (t ? 'Guardar cambios' : 'Apuntar') + '</button></div>';
    enlazarVolver();
    if (!t) pintarFotosFormNueva();
    $('#nPrio').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; v.prioridad = b.dataset.p; $$('button', this).forEach(function (x) { x.classList.toggle('activo', x === b); }); };
    $('#nUrg').onchange = function () { v.urgente = this.checked; $('#nUrgL').classList.toggle('on', this.checked); };
    if ($('#nEstado')) $('#nEstado').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; v.estado = b.dataset.e; $$('button', this).forEach(function (x) { x.classList.toggle('activo', x === b); }); };
    $('#nCancelar').onclick = function () { S.nuevasFotos = []; if (t) volver(); else ir('lista'); };
    $('#nGuardar').onclick = function () {
      v.titulo = $('#nTitulo').value.trim();
      if (!v.titulo) { $('#nError').textContent = 'Escribe qué hace falta.'; $('#nTitulo').focus(); return; }
      var respAntes = t ? (t.responsable || '') : '';
      v.espacioId = $('#nEsp').value; v.categoriaId = $('#nCat').value; v.lugar = $('#nLugar').value.trim();
      v.responsable = $('#nResp').value; v.limite = $('#nLimite').value; v.descripcion = $('#nDesc').value.trim();
      if ($('#nNotas')) v.notas = $('#nNotas').value.trim();
      var pedirWa = !!(v.responsable && v.responsable !== S.quien && v.responsable !== respAntes);
      var fotosAsig = (!t && S.nuevasFotos && S.nuevasFotos.length) ? S.nuevasFotos.slice() : [];
      guardar('guardarTarea', { tarea: v }, t ? 'Cambios guardados' : 'Apuntada').then(function (d) {
        S.nuevasFotos = [];
        var pFotos = (fotosAsig.length && d && d.id) ? guardar('fotosATarea', { tareaId: d.id, fotos: fotosAsig }) : Promise.resolve();
        return pFotos.then(function () {
          var salirForm = function () {
            if (t) { history.length > 1 && historial > 0 ? history.back() : ir('tarea/' + encodeURIComponent(t.id)); }
            else ir('lista');
          };
          if (pedirWa && d && d.id) modalAvisoGuardado(d.id, salirForm);
          else salirForm();
        });
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
    proveedores().forEach(function (p) {
      var s = (p.servicio || '').trim();
      if (!s) return;
      var k = sinAcentos(s);
      if (!vistos.some(function (v) { return sinAcentos(v) === k; })) vistos.push(s);
    });
    return vistos.sort(function (a, b) { return a.localeCompare(b, 'es', { sensitivity: 'base' }); });
  }
  function buscarServicioExistente(texto) {
    var k = sinAcentos((texto || '').trim());
    if (!k) return '';
    var enc = servicios().filter(function (s) { return sinAcentos(s) === k; })[0];
    return enc || (texto || '').trim();
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
    var listaServ = servicios();
    var servAct = p.servicio ? buscarServicioExistente(p.servicio) : '';
    if (servAct && listaServ.indexOf(servAct) < 0) { listaServ.push(servAct); listaServ.sort(function (a, b) { return a.localeCompare(b, 'es', { sensitivity: 'base' }); }); }
    var campo = function (k, et, max, extra) {
      return '<label class="campo"><span>' + et + '</span><input class="entrada" id="v_' + k + '" maxlength="' + max + '" value="' + esc(p[k]) + '"' + (extra || '') + '></label>';
    };
    modal('<h2>' + (id ? 'Editar proveedor' : 'Nuevo proveedor') + '</h2>' +
      '<label class="campo"><span>Servicio *</span><select class="entrada" id="v_servicio">' +
      '<option value="">— Elegir servicio —</option>' +
      listaServ.map(function (x) { return '<option value="' + esc(x) + '"' + (x === servAct ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') +
      '<option value="__nuevo__">+ Nuevo servicio…</option></select></label>' +
      '<label class="campo" id="v_servicio_nuevo_wrap" hidden><span>Nombre del nuevo servicio *</span><input class="entrada" id="v_servicio_nuevo" maxlength="60" placeholder="Ej.: Fontanería"></label>' +
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
        var selS = $('#v_servicio').value;
        d.servicio = selS === '__nuevo__' ? buscarServicioExistente($('#v_servicio_nuevo').value.trim()) : selS.trim();
        ['empresa', 'contacto', 'tel1', 'tel2', 'email', 'direccion', 'web', 'notas'].forEach(function (k) { d[k] = $('#v_' + k).value.trim(); });
        if (!d.servicio) {
          $('#vError').textContent = selS === '__nuevo__' ? 'Escribe el nombre del nuevo servicio.' : 'Elige un servicio.';
          return;
        }
        if (!d.empresa) { $('#vError').textContent = 'Escribe el nombre de la empresa o persona.'; return; }
        guardar('guardarProveedor', { proveedor: d }, 'Guardado').then(function () { S.prov.abiertos[d.servicio] = true; cerrar(); pintarProveedores(); },
          function (err) { if ($('#vError')) $('#vError').textContent = err.message; });
      });
    if ($('#v_servicio')) $('#v_servicio').onchange = function () {
      var nuevo = this.value === '__nuevo__';
      $('#v_servicio_nuevo_wrap').hidden = !nuevo;
      if (nuevo) setTimeout(function () { $('#v_servicio_nuevo') && $('#v_servicio_nuevo').focus(); }, 30);
    };
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
      '<label class="check"><input type="checkbox" id="eActivo"' + (e.activo ? ' checked' : '') + '> Activo (aparece al apuntar tareas)</label>' +
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
      '<p class="sub" style="margin:10px 0 0">Queda anotado en cada tarea que apuntes o cambies. Para entrar como otra persona, cierra la sesión.</p></div>' +
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

  // ---------------- Imprimir lista de tareas en PDF (D24) ----------------
  var CRITERIOS_PDF = [
    { id: 'importancia', nombre: 'Importancia', sub: 'Urgentes primero, después Alta, Media y Baja' },
    { id: 'responsable', nombre: 'Responsable', sub: 'Agrupadas por persona asignada' },
    { id: 'categoria',   nombre: 'Categoría',   sub: 'Fontanería, Electricidad, Pintura…' },
    { id: 'estado',      nombre: 'Estado',      sub: 'Pendiente, En curso, Esperando…' },
    { id: 'espacio',     nombre: 'Espacio',     sub: 'Agrupadas por estancia de la casa' }
  ];
  var INCLUIR_PDF = [
    { id: 'pendientes', nombre: 'Pendientes',             sub: 'Todas las tareas por hacer (sin las hechas)' },
    { id: 'todas',      nombre: 'Pendientes y hechas',    sub: 'Incluye también el historial de tareas hechas' },
    { id: 'actual',     nombre: 'Solo lo que se ve ahora', sub: 'Con los filtros y búsqueda actuales de la pantalla' }
  ];
  var pdfCarga = null, logoCache = null;
  function cargarJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable) {
      return Promise.resolve(window.jspdf.jsPDF);
    }
    if (!pdfCarga) {
      pdfCarga = cargarScript('lib/jspdf.umd.min.js')
        .then(function () { return cargarScript('lib/jspdf.plugin.autotable.min.js'); })
        .then(function () {
          if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('No se pudo cargar el generador de PDF.');
          return window.jspdf.jsPDF;
        }, function (e) { pdfCarga = null; throw e; });
    }
    return pdfCarga;
  }
  function cargarLogoPdf() {
    if (logoCache !== null) return Promise.resolve(logoCache);
    return new Promise(function (ok) {
      var img = new Image();
      img.onload = function () {
        try {
          var c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          logoCache = { data: c.toDataURL('image/png'), w: c.width, h: c.height };
        } catch (e) { logoCache = false; }
        ok(logoCache);
      };
      img.onerror = function () { logoCache = false; ok(false); };
      img.src = 'icons/logo-casa-maria-madre.png';
    });
  }
  function modalImprimir() {
    var pref = lsGet('pdfOpciones') || {};
    var critActual = S.f && S.f.agrupar;
    var crit = CRITERIOS_PDF.some(function (c) { return c.id === critActual; }) ? critActual
      : (CRITERIOS_PDF.some(function (c) { return c.id === pref.criterio; }) ? pref.criterio : 'importancia');
    var inc = INCLUIR_PDF.some(function (i) { return i.id === pref.incluir; }) ? pref.incluir : 'pendientes';
    var conNotas = !!pref.notas;
    var numLineas = [1, 2, 3].indexOf(Number(pref.lineas)) >= 0 ? Number(pref.lineas) : 2;
    var htmlRadio = function (grupo, items, sel) {
      return '<div class="opciones-pdf" data-grupo="' + grupo + '">' + items.map(function (it) {
        var on = it.id === sel;
        return '<label class="opcion-radio' + (on ? ' activo' : '') + '"><input type="radio" name="pdf_' + grupo + '" value="' + it.id + '"' + (on ? ' checked' : '') + '>' +
          '<div><span>' + esc(it.nombre) + '</span>' + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</div></label>';
      }).join('') + '</div>';
    };
    modal('<h2>Imprimir lista de tareas</h2>' +
      '<label class="campo"><span>Organizar por</span></label>' + htmlRadio('criterio', CRITERIOS_PDF, crit) +
      '<label class="campo"><span>Qué incluir</span></label>' + htmlRadio('incluir', INCLUIR_PDF, inc) +
      '<div class="notas-pdf-box"><label class="check"><input type="checkbox" id="pdfNotas"' + (conNotas ? ' checked' : '') + '> Espacio para notas a mano</label>' +
      '<div class="notas-pdf-lineas" id="pdfNotasLineasWrap"' + (conNotas ? '' : ' hidden') + '><span>Líneas por tarea</span>' +
      '<div class="segmento tres" id="pdfNotasLineas">' + [1, 2, 3].map(function (n) {
        return '<button type="button" data-lin="' + n + '" class="' + (numLineas === n ? 'activo' : '') + '">' + n + (n === 1 ? ' línea' : ' líneas') + '</button>';
      }).join('') + '</div></div></div>' +
      '<div class="fila-btns"><button class="btn borde" data-r="0">Cancelar</button><button class="btn" data-r="1">Crear PDF</button></div>',
      function (ev, cerrar) {
        var r = ev.target.closest('.opcion-radio');
        if (r) {
          var g = r.closest('.opciones-pdf');
          $$('.opcion-radio', g).forEach(function (x) { x.classList.toggle('activo', x === r); });
          var inp = $('input', r);
          if (inp) { inp.checked = true; if (g.dataset.grupo === 'criterio') crit = inp.value; else inc = inp.value; }
        }
        var bl = ev.target.closest('[data-lin]');
        if (bl) {
          numLineas = Number(bl.dataset.lin);
          $$('#pdfNotasLineas button').forEach(function (x) { x.classList.toggle('activo', x === bl); });
          return;
        }
        var b = ev.target.closest('[data-r]'); if (!b) return;
        if (b.dataset.r === '0') return cerrar();
        lsSet('pdfOpciones', { criterio: crit, incluir: inc, notas: conNotas, lineas: numLineas });
        cerrar();
        generarPdfTareas(crit, inc, conNotas ? numLineas : 0);
      });
    if ($('#pdfNotas')) $('#pdfNotas').onchange = function () {
      conNotas = this.checked;
      $('#pdfNotasLineasWrap').hidden = !conNotas;
    };
  }
  function agruparParaPdf(listaTareas, criterio) {
    var ordenadas = ordenar(listaTareas);
    var grupos = [], mapa = {};
    function poner(clave, titulo) {
      if (!mapa[clave]) { mapa[clave] = { titulo: titulo, items: [] }; grupos.push(mapa[clave]); }
      return mapa[clave];
    }
    if (criterio === 'importancia') {
      [['urg', 'Urgentes', '⚠️ Urgentes', 'urgente'], ['Alta', 'Prioridad alta', 'Alta', 'alta'], ['Media', 'Prioridad media', 'Media', 'media'], ['Baja', 'Prioridad baja', 'Baja', 'baja']].forEach(function (g) {
        var it = ordenadas.filter(function (t) {
          return g[0] === 'urg' ? t.urgente : (!t.urgente && (t.prioridad || 'Media') === g[0]);
        });
        if (it.length) grupos.push({ titulo: g[1], tituloLista: g[2], clase: g[3], items: it });
      });
      return grupos;
    }
    if (criterio === 'estado') {
      ESTADOS.forEach(function (e) {
        var it = ordenadas.filter(function (t) { return (t.estado || 'Pendiente') === e; });
        if (it.length) grupos.push({ titulo: e, items: it });
      });
      return grupos;
    }
    if (criterio === 'responsable') {
      lista('responsables').forEach(function (r) {
        var it = ordenadas.filter(function (t) { return t.responsable === r.nombre; });
        if (it.length) poner('r:' + r.nombre, r.nombre);
      });
      ordenadas.forEach(function (t) {
        var k = t.responsable ? 'r:' + t.responsable : 'sin';
        poner(k, t.responsable || 'Sin asignar').items.push(t);
      });
      return grupos;
    }
    if (criterio === 'categoria') {
      lista('categorias').forEach(function (c) {
        var it = ordenadas.filter(function (t) { return t.categoriaId === c.id || (!t.categoriaId && t.categoria === c.nombre); });
        if (it.length) poner('c:' + c.id, c.nombre);
      });
      ordenadas.forEach(function (t) {
        var nom = nombreCategoria(t), k = t.categoriaId ? 'c:' + t.categoriaId : (nom ? 'cn:' + nom : 'sin');
        poner(k, nom || 'Sin categoría').items.push(t);
      });
      return grupos;
    }
    if (criterio === 'espacio') {
      lista('espacios').forEach(function (e) {
        var it = ordenadas.filter(function (t) { return t.espacioId === e.id || (!t.espacioId && t.espacio === e.nombre); });
        if (it.length) poner('e:' + e.id, (e.codigo ? e.codigo + ' · ' : '') + e.nombre);
      });
      ordenadas.forEach(function (t) {
        var nom = nombreEspacio(t), cod = codigoEspacio(t), tit = (cod ? cod + ' · ' : '') + (nom || 'Sin espacio');
        var k = t.espacioId ? 'e:' + t.espacioId : (nom ? 'en:' + nom : 'sin');
        poner(k, tit).items.push(t);
      });
      return grupos;
    }
    return [{ titulo: 'Tareas', items: ordenadas }];
  }
  function textoImportanciaPdf(t) {
    var p = t.prioridad || 'Media';
    return t.urgente ? 'URGENTE' + (p !== 'Alta' ? ' (' + p + ')' : '') : p;
  }
  function colorImportanciaPdf(t) {
    if (t.urgente) return [198, 40, 40];         // rojo urgente (#C62828)
    var p = t.prioridad || 'Media';
    if (p === 'Alta') return [122, 29, 11];     // granate (#7A1D0B)
    if (p === 'Media') return [185, 119, 14];   // ámbar oscuro (#B9770E)
    return [107, 113, 122];                     // gris pizarra (#6B717A)
  }
  function colorEstadoPdf(e) {
    if (e === 'Hecha') return [31, 122, 69];    // verde (#1F7A45)
    if (e === 'En curso') return [11, 110, 138];// azul (#0B6E8A)
    if (e === 'Esperando') return [185, 119, 14];
    return [83, 74, 69];
  }
  function generarPdfTareas(criterio, incluir, lineasNotas) {
    var nLin = Number(lineasNotas) || 0;
    var altoLineaNota = 6.5;
    var extraNota = nLin > 0 ? (nLin * altoLineaNota + 2) : 0;
    var seleccion = incluir === 'todas' ? tareas().slice()
      : incluir === 'actual' ? tareasVisiblesLista()
      : tareas().filter(function (t) { return t.estado !== 'Hecha'; });
    if (!seleccion.length) { toast('No hay tareas para incluir en el PDF.', true); return; }
    var critObj = CRITERIOS_PDF.filter(function (c) { return c.id === criterio; })[0] || CRITERIOS_PDF[0];
    var incObj = INCLUIR_PDF.filter(function (i) { return i.id === incluir; })[0] || INCLUIR_PDF[0];
    cargando(true);
    Promise.all([cargarJsPDF(), cargarLogoPdf()]).then(function (res) {
      var jsPDF = res[0], logo = res[1];
      var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      var M = 14, W = 210, H = 297, util = W - M * 2;
      var GRANATE = [133, 32, 12], TEXTO = [31, 26, 23], GRIS = [85, 85, 85], LINEA = [221, 213, 204], SUAVE = [247, 241, 234];
      var ahora = new Date();
      var fechaHora = pad(ahora.getDate()) + '/' + pad(ahora.getMonth() + 1) + '/' + ahora.getFullYear() + ' ' + pad(ahora.getHours()) + ':' + pad(ahora.getMinutes());
      var casa = C.NOMBRE_CASA || 'Casa de Espiritualidad María Madre';

      // Cabecera corporativa (mismo estilo que la Hoja de estancia de APP_Maria_Madre)
      var y = M;
      if (logo && logo.data) {
        var lw = 52, lh = lw * (logo.h / logo.w);
        doc.addImage(logo.data, 'PNG', M, y, lw, lh);
      } else {
        doc.setFont('times', 'bold'); doc.setFontSize(16); doc.setTextColor(GRANATE[0], GRANATE[1], GRANATE[2]);
        doc.text(casa, M, y + 6);
      }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
      doc.text('C/ Donante de Sangre, 1 · 19002 Guadalajara · Tel. 612 491 985', M, y + 16);
      doc.text('casamariamadre@siguenza-guadalajara.org', M, y + 20.2);

      // Bloque derecho de cabecera
      doc.setFont('times', 'bold'); doc.setFontSize(14.5); doc.setTextColor(TEXTO[0], TEXTO[1], TEXTO[2]);
      doc.text('TAREAS DE MANTENIMIENTO', W - M, y + 5, { align: 'right' });

      var selloTxt = 'ORGANIZADO POR: ' + critObj.nombre.toUpperCase();
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      var sw = doc.getTextWidth(selloTxt) + 6;
      doc.setFillColor(GRANATE[0], GRANATE[1], GRANATE[2]);
      doc.roundedRect(W - M - sw, y + 7.2, sw, 5.2, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(selloTxt, W - M - sw / 2, y + 10.8, { align: 'center' });

      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
      doc.text(fechaHora + ' · Impreso por ' + (S.quien || '—'), W - M, y + 16.5, { align: 'right' });
      doc.text(incObj.nombre + ' (' + seleccion.length + (seleccion.length === 1 ? ' tarea' : ' tareas') + ')' + (nLin ? ' · ' + nLin + (nLin === 1 ? ' línea de notas' : ' líneas de notas') : ''), W - M, y + 20.5, { align: 'right' });

      y += 23.5;
      doc.setDrawColor(GRANATE[0], GRANATE[1], GRANATE[2]); doc.setLineWidth(0.8);
      doc.line(M, y, W - M, y);
      y += 5;

      // Columnas de las tablas (no se repite la columna por la que se agrupa, salvo Lugar en Espacio si tiene lugar exacto)
      var cols = [{ dataKey: 'chk', header: '' }, { dataKey: 'tarea', header: 'Tarea' }, { dataKey: 'lugar', header: 'Lugar' }];
      if (criterio !== 'responsable') cols.push({ dataKey: 'responsable', header: 'Responsable' });
      if (criterio !== 'importancia') cols.push({ dataKey: 'importancia', header: 'Importancia' });
      if (criterio !== 'estado') cols.push({ dataKey: 'estado', header: 'Estado' });
      cols.push({ dataKey: 'limite', header: 'Fecha límite' });

      var grupos = agruparParaPdf(seleccion, criterio);
      grupos.forEach(function (g) {
        if (y > H - 36) { doc.addPage(); y = M + 2; }
        doc.setFont('times', 'bold'); doc.setFontSize(12); doc.setTextColor(GRANATE[0], GRANATE[1], GRANATE[2]);
        doc.text(g.titulo + ' (' + g.items.length + ')', M, y + 4);
        y += 6;

        var body = g.items.map(function (t) {
          var cat = (criterio !== 'categoria' && nombreCategoria(t)) ? nombreCategoria(t) : '';
          var det = [cat, t.descripcion, t.notas].filter(Boolean).join(' · ');
          var prefUrg = (criterio === 'importancia' && t.urgente) ? 'URGENTE · ' : '';
          var tit = prefUrg + t.titulo + (det ? '\n' + det : '');
          var lug = criterio === 'espacio' ? (t.lugar || '—') : (textoLugar(t) || '—');
          var lim = t.limite ? legible(t.limite) + (vencida(t) ? ' (vencida)' : '') : '—';
          return {
            _t: t,
            chk: '',
            tarea: tit,
            lugar: lug,
            responsable: t.responsable || '—',
            importancia: textoImportanciaPdf(t),
            estado: t.estado || 'Pendiente',
            limite: lim
          };
        });

        doc.autoTable({
          startY: y,
          margin: { left: M, right: M, top: M + 4, bottom: 16 },
          columns: cols,
          body: body,
          theme: 'plain',
          rowPageBreak: 'avoid',
          styles: {
            font: 'helvetica', fontSize: 9,
            cellPadding: { top: 2.2, right: 2, bottom: 2.2 + extraNota, left: 2 },
            textColor: TEXTO, lineColor: LINEA, lineWidth: 0,
            valign: nLin > 0 ? 'top' : 'middle', overflow: 'linebreak'
          },
          headStyles: {
            fillColor: SUAVE, textColor: [68, 68, 68], fontStyle: 'bold', fontSize: 8,
            cellPadding: { top: 2.2, right: 2, bottom: 2.2, left: 2 }
          },
          columnStyles: {
            chk: { cellWidth: 8, halign: 'center' },
            lugar: { cellWidth: 36 },
            responsable: { cellWidth: 23 },
            importancia: { cellWidth: 26, fontStyle: 'bold' },
            estado: { cellWidth: 21 },
            limite: { cellWidth: 23 }
          },
          didParseCell: function (data) {
            if (data.section === 'body' && data.column.dataKey === 'importancia') {
              var t = data.row.raw._t;
              data.cell.styles.textColor = colorImportanciaPdf(t);
              data.cell.styles.fontStyle = 'bold';
              if (t.urgente && !nLin) data.cell.styles.fillColor = [253, 228, 225];
            }
            if (data.section === 'body' && data.column.dataKey === 'tarea' && criterio === 'importancia' && data.row.raw._t.urgente) {
              data.cell.styles.textColor = [198, 40, 40];
              data.cell.styles.fontStyle = 'bold';
            }
            if (data.section === 'body' && data.column.dataKey === 'estado') {
              var t2 = data.row.raw._t;
              data.cell.styles.textColor = colorEstadoPdf(t2.estado || 'Pendiente');
              data.cell.styles.fontStyle = 'bold';
            }
            if (data.section === 'body' && data.column.dataKey === 'limite' && vencida(data.row.raw._t)) {
              data.cell.styles.textColor = [198, 40, 40];
              data.cell.styles.fontStyle = 'bold';
            }
          },
          didDrawCell: function (data) {
            var c = data.cell;
            if (data.section === 'head') {
              doc.setDrawColor(GRANATE[0], GRANATE[1], GRANATE[2]); doc.setLineWidth(0.5);
              doc.line(c.x, c.y + c.height, c.x + c.width, c.y + c.height);
              if (data.column.dataKey === 'chk') {
                var sh = 3.2, cxh = c.x + (c.width - sh) / 2, cyh = c.y + (c.height - sh) / 2;
                doc.setDrawColor(68, 68, 68); doc.setLineWidth(0.35);
                doc.rect(cxh, cyh, sh, sh);
              }
            } else if (data.section === 'body') {
              doc.setDrawColor(LINEA[0], LINEA[1], LINEA[2]); doc.setLineWidth(0.2);
              if (nLin > 0) {
                for (var li = 1; li < nLin; li++) {
                  var ly = c.y + c.height - (nLin - li) * altoLineaNota;
                  doc.line(c.x, ly, c.x + c.width, ly);
                }
              }
              doc.line(c.x, c.y + c.height, c.x + c.width, c.y + c.height);
              if (data.column.dataKey === 'chk') {
                var s = 3.8, cx = c.x + (c.width - s) / 2;
                var cy = nLin > 0 ? (c.y + 2.4) : (c.y + (c.height - s) / 2);
                var hecha = (data.row.raw._t.estado === 'Hecha');
                doc.setDrawColor(GRANATE[0], GRANATE[1], GRANATE[2]); doc.setLineWidth(0.35);
                doc.rect(cx, cy, s, s);
                if (hecha) {
                  doc.setLineWidth(0.5);
                  doc.line(cx + 0.7, cy + s * 0.55, cx + s * 0.42, cy + s - 0.7);
                  doc.line(cx + s * 0.42, cy + s - 0.7, cx + s - 0.6, cy + 0.7);
                }
              }
            }
          }
        });
        y = doc.lastAutoTable.finalY + 6;
      });

      // Pie de página corporativo en todas las páginas («Página X de Y»)
      var totalPag = doc.getNumberOfPages();
      for (var p = 1; p <= totalPag; p++) {
        doc.setPage(p);
        doc.setDrawColor(LINEA[0], LINEA[1], LINEA[2]); doc.setLineWidth(0.3);
        doc.line(M, H - 12, W - M, H - 12);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
        doc.text(casa + ' · Tareas de mantenimiento', M, H - 8);
        doc.text('Página ' + p + ' de ' + totalPag, W - M, H - 8, { align: 'right' });
      }

      var nombre = 'Tareas_' + hoyTxt() + '_por-' + criterio + '.pdf';
      var blob = doc.output('blob');
      window.__ULTIMO_PDF__ = {
        nombre: nombre, criterio: criterio, incluir: incluir,
        tareas: seleccion.length, grupos: grupos.map(function (g) { return g.titulo + ' (' + g.items.length + ')'; }),
        columnas: cols.map(function (c) { return c.header; }), paginas: totalPag, bytes: blob.size
      };
      cargando(false);
      entregarPdf(blob, nombre);
    }).catch(function (e) {
      cargando(false);
      toast((e && e.message) || 'No se pudo crear el PDF.', true);
    });
  }
  function entregarPdf(blob, nombre) {
    try {
      var archivo = new File([blob], nombre, { type: 'application/pdf' });
      if (navigator.canShare && navigator.share && navigator.canShare({ files: [archivo] })) {
        navigator.share({ files: [archivo], title: nombre }).then(function () {
          toast('PDF listo');
        }, function (err) {
          if (err && err.name === 'AbortError') return;
          descargarPdf(blob, nombre);
        });
        return;
      }
    } catch (e) {}
    descargarPdf(blob, nombre);
  }
  function descargarPdf(blob, nombre) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    toast('PDF descargado: ' + nombre);
    setTimeout(function () { URL.revokeObjectURL(url); }, 15000);
  }

  // ---------------- Arranque ----------------
  (function () {
    try {
      var q = new URLSearchParams(location.search), tid = q.get('tarea');
      if (tid) {
        ssSet('tareaEnlace', tid.trim());
        history.replaceState(null, '', location.pathname + location.hash);
      }
    } catch (e) {}
  })();
  $('#tituloCasa').textContent = C.NOMBRE_CASA || 'Tareas';
  $('#menu').onclick = function (e) { var b = e.target.closest('button[data-ir]'); if (b) ir(b.dataset.ir); };
  $('#btnRecargar').onclick = function () { recargar(); };
  if ($('#btnImprimir')) $('#btnImprimir').onclick = modalImprimir;
  window.addEventListener('hashchange', pintar);
  // Al volver a la app: actualizar datos sin borrar lo que se esté escribiendo.
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.quien && S.datos) recargar(true); });
  avisoConexion();

  S.quien = lsGet('quien'); S.pin = lsGet('pin');
  if (S.quien && S.pin) {
    var c = lsGet('cache');
    if (c && !ssGet('tareaEnlace')) { S.datos = c.datos; pintar(); }
    recargar(!!(c && !ssGet('tareaEnlace')));
  } else pintarLogin();

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
})();
