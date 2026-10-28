"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { MultiPolygon, Polygon } from "geojson";

type LatLon = [lat: number, lon: number];

/** Paleta do globo (combina com o painel de partidas). */
const C = {
  oceano: 0x10304f,
  atmosfera: 0x5fb0ff,
  rota: 0xf2b705,
  atraso: 0xe55a4c,
  fantasma: 0x9aa8b5,
};
/** Cores do mapa desenhado no canvas. */
const MAPA = {
  oceanoPolo: "#0a1d31",
  oceanoEquador: "#12385c",
  grade: "rgba(150,190,230,0.08)",
  terra: "#2b4a3f",
  borda: "rgba(190,220,205,0.28)",
  pais: "#3e9b72",
  paisBorda: "#b7f0d2",
  paisBrilho: "rgba(120,235,180,0.55)",
};

const KM_RAIO = 6371;
const KM_POR_MIN = 12.5; // ~750 km/h em cruzeiro
const MIN_SOLO = 20; // taxiamento, subida e descida

function vetor([lat, lon]: LatLon, r = 1) {
  const fi = THREE.MathUtils.degToRad(lat);
  const la = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(fi) * Math.cos(la), Math.sin(fi), -Math.cos(fi) * Math.sin(la)).multiplyScalar(r);
}

/** Pontos de um arco de grande círculo, erguido no meio do caminho. */
function arco(a: THREE.Vector3, b: THREE.Vector3, altura: number, n = 160) {
  const angulo = a.angleTo(b);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p =
      angulo < 1e-6
        ? a.clone()
        : a
            .clone()
            .multiplyScalar(Math.sin((1 - t) * angulo) / Math.sin(angulo))
            .add(b.clone().multiplyScalar(Math.sin(t * angulo) / Math.sin(angulo)));
    pts.push(p.normalize().multiplyScalar(1 + altura * Math.sin(Math.PI * t)));
  }
  return pts;
}

/** Um anel (lon, lat) no Path2D em projeção equirretangular, desenhado 3 vezes para cobrir o antimeridiano. */
function anel(path: Path2D, ring: number[][], W: number, H: number) {
  const pts: [number, number][] = [];
  let soma = 0;
  let anterior = ring[0][0];
  for (const [lon, lat] of ring) {
    let l = lon + soma;
    if (l - anterior > 180) {
      soma -= 360;
      l -= 360;
    } else if (l - anterior < -180) {
      soma += 360;
      l += 360;
    }
    pts.push([l, lat]);
    anterior = l;
  }
  // Anel que dá a volta no globo (Antártida): fecha pelo polo.
  if (Math.abs(pts[pts.length - 1][0] - pts[0][0]) > 180) {
    const polo = pts.reduce((s, q) => s + q[1], 0) / pts.length < 0 ? -90 : 90;
    pts.push([pts[pts.length - 1][0], polo], [pts[0][0], polo]);
  }
  for (const desloc of [-360, 0, 360]) {
    pts.forEach(([lon, lat], i) => {
      const x = ((lon + desloc + 180) / 360) * W;
      const y = ((90 - lat) / 180) * H;
      if (i) path.lineTo(x, y);
      else path.moveTo(x, y);
    });
    path.closePath();
  }
}

/** Textura do globo: oceano, grade, países e o país da rota em destaque. */
function desenharMapa(topo: Topology, pontos: LatLon[], W: number) {
  const H = W / 2;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  const k = W / 4096; // espessuras pensadas para 4096 px

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, MAPA.oceanoPolo);
  g.addColorStop(0.5, MAPA.oceanoEquador);
  g.addColorStop(1, MAPA.oceanoPolo);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = MAPA.grade;
  ctx.lineWidth = 1.5 * k;
  ctx.beginPath();
  for (let lon = -180; lon <= 180; lon += 15) {
    const x = ((lon + 180) / 360) * W;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const y = ((90 - lat) / 180) * H;
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();

  const obj = topo.objects.countries as GeometryCollection;
  const paises = (feature(topo, obj) as GeoJSON.FeatureCollection<Polygon | MultiPolygon>).features.map((f) => {
    const path = new Path2D();
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) for (const ring of poly) anel(path, ring, W, H);
    return path;
  });

  const dentro = (path: Path2D) =>
    pontos.some(([lat, lon]) => ctx.isPointInPath(path, ((lon + 180) / 360) * W, ((90 - lat) / 180) * H, "evenodd"));
  const destaque = paises.filter(dentro);

  ctx.lineJoin = "round";
  ctx.fillStyle = MAPA.terra;
  ctx.strokeStyle = MAPA.borda;
  ctx.lineWidth = 1.6 * k;
  for (const p of paises) {
    ctx.fill(p, "evenodd");
    ctx.stroke(p);
  }
  ctx.save();
  ctx.shadowColor = MAPA.paisBrilho;
  ctx.shadowBlur = 16 * k;
  ctx.fillStyle = MAPA.pais;
  for (const p of destaque) ctx.fill(p, "evenodd");
  ctx.restore();
  ctx.strokeStyle = MAPA.paisBorda;
  ctx.lineWidth = 3 * k;
  for (const p of destaque) ctx.stroke(p);
  return cv;
}

/** Brilho da atmosfera: mais forte rente à borda do globo, some para fora. */
function atmosfera() {
  return new THREE.ShaderMaterial({
    uniforms: { cor: { value: new THREE.Color(C.atmosfera) } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 cor; varying vec3 vN; varying vec3 vV;
      void main(){ float d = -dot(vN, vV); float i = pow(clamp(d / 0.42, 0.0, 1.0), 3.5) * 0.65; gl_FragColor = vec4(cor * i, i); }`,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
}

/** Luz rente à borda, por cima do mapa (dá volume ao globo). */
function borda() {
  return new THREE.ShaderMaterial({
    uniforms: { cor: { value: new THREE.Color(C.atmosfera) } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 cor; varying vec3 vN; varying vec3 vV;
      void main(){ float i = pow(1.0 - max(dot(vN, vV), 0.0), 3.0) * 0.5; gl_FragColor = vec4(cor * i, i); }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
}

/** Halo circular (textura de gradiente radial) para destacar o avião. */
function texturaHalo() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.35, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

/** Avião em unidades de "comprimento da fuselagem"; o nariz aponta para +Z. */
function aviao(cor: number, opacidade = 1, halo?: THREE.Texture) {
  const transparente = opacidade < 1;
  const corpo = new THREE.MeshLambertMaterial({
    color: cor,
    emissive: new THREE.Color(cor).multiplyScalar(transparente ? 0.2 : 0.45),
    transparent: transparente,
    opacity: opacidade,
  });
  const detalhe = new THREE.MeshLambertMaterial({ color: 0x1a2633, transparent: transparente, opacity: opacidade });
  const g = new THREE.Group();
  const fuselagem = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.055, 0.95, 14), corpo);
  fuselagem.rotation.x = Math.PI / 2;
  const nariz = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), corpo);
  nariz.rotation.x = Math.PI / 2;
  nariz.scale.y = 2;
  nariz.position.z = 0.475;
  const cabine = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.09), detalhe);
  cabine.position.set(0, 0.06, 0.5);
  const asa = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.025, 0.2), corpo);
  asa.position.z = 0.05;
  const motores = [-0.28, 0.28].map((x) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 10), detalhe);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, -0.05, 0.12);
    return m;
  });
  const cauda = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.11), corpo);
  cauda.position.z = -0.42;
  const deriva = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.22, 0.15), corpo);
  deriva.position.set(0, 0.11, -0.41);
  g.add(fuselagem, nariz, cabine, asa, cauda, deriva, ...motores);
  if (halo) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: halo, color: cor, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 }),
    );
    sprite.scale.setScalar(2.6);
    g.add(sprite);
  }
  return g;
}

/** Aeroporto estilizado em unidades de "comprimento do avião": pista ao longo de +Z, terminal e torre ao lado. */
function aeroporto() {
  const g = new THREE.Group();
  const mat = (color: number, emissivo = 0) =>
    new THREE.MeshLambertMaterial({ color, emissive: new THREE.Color(color).multiplyScalar(emissivo) });
  const caixa = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, giro = 0) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y + h / 2, z);
    b.rotation.y = giro;
    g.add(b);
    return b;
  };

  // Pátio
  const patio = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.02, 48), mat(0x22374a, 0.2));
  patio.position.y = 0.01;
  g.add(patio);

  // Pistas (a principal no sentido da rota, outra cruzada) e taxiway
  const asfalto = mat(0x1b232b, 0.1);
  const faixa = mat(0xffffff, 0.8);
  caixa(0.36, 0.03, 2.3, asfalto, 0, 0.02, 0);
  for (let z = -0.95; z <= 0.95; z += 0.24) caixa(0.025, 0.005, 0.11, faixa, 0, 0.05, z);
  for (const z of [-1.08, 1.08]) for (const x of [-0.1, -0.05, 0.05, 0.1]) caixa(0.025, 0.005, 0.1, faixa, x, 0.05, z);
  const cruzada = caixa(0.24, 0.03, 1.5, asfalto, -0.42, 0.02, -0.15, 0.6);
  cruzada.position.y = 0.035;
  caixa(0.07, 0.025, 1.9, mat(0x2c3946, 0.1), 0.42, 0.02, 0);
  for (const z of [-0.6, 0, 0.6]) caixa(0.32, 0.025, 0.06, mat(0x2c3946, 0.1), 0.27, 0.02, z);

  // Terminal com faixa de vidro e píeres
  const concreto = mat(0xdfe5eb, 0.25);
  const vidro = mat(0x5ab4ff, 0.7);
  caixa(0.3, 0.16, 1.0, concreto, 0.78, 0.02, 0);
  caixa(0.31, 0.04, 1.01, vidro, 0.78, 0.1, 0);
  caixa(0.34, 0.02, 1.04, mat(0x9aa8b5, 0.2), 0.78, 0.18, 0);
  for (const z of [-0.35, 0, 0.35]) caixa(0.2, 0.06, 0.06, concreto, 0.56, 0.02, z);

  // Torre de controle com farol
  const torre = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.55, 12), concreto);
  torre.position.set(0.72, 0.3, -0.82);
  const cabine = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.09, 12), vidro);
  cabine.position.set(0.72, 0.62, -0.82);
  const teto = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 12), mat(0x9aa8b5, 0.2));
  teto.position.set(0.72, 0.675, -0.82);
  const farol = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff4d3d }));
  farol.position.set(0.72, 0.71, -0.82);
  g.add(torre, cabine, teto, farol);
  return { grupo: g, farol };
}

/** Coloca `obj` sobre o ponto `v` da esfera, de pé, com +Z apontando para `rumo` (no plano tangente). */
function assentar(obj: THREE.Object3D, v: THREE.Vector3, rumo: THREE.Vector3) {
  const y = v.clone().normalize();
  const z = rumo.clone().addScaledVector(y, -rumo.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  obj.position.copy(y);
}

const hhmm = (base: string, somaMin: number) => {
  const [h, m] = base.split(":").map(Number);
  const t = (((h * 60 + m + Math.round(somaMin)) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

interface Props {
  origem: LatLon;
  destino: LatLon;
  siglaOrigem: string;
  siglaDestino: string;
  horario: string; // partida prevista HH:MM
  atraso: number; // atraso real da partida, min
}

export default function GloboVoo({ origem, destino, siglaOrigem, siglaDestino, horario, atraso }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const rotulos = useRef<(HTMLSpanElement | null)[]>([]);
  const hud = useRef<{ relogio: HTMLSpanElement | null; status: HTMLSpanElement | null }>({ relogio: null, status: null });
  const [rodada, setRodada] = useState(0);

  const espera = Math.max(atraso, 0);
  const atrasou = espera > 0;
  const atrasoForte = atraso > 30;
  const corAviao = atrasoForte ? "#e55a4c" : atraso > 0 ? "#e2b232" : "#ffffff";

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.prepend(renderer.domElement);
    renderer.domElement.style.display = "block";

    const cena = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);

    // Luz presa à câmera: o lado que se vê fica sempre iluminado, com sombra suave na borda
    cena.add(camera);
    cena.add(new THREE.AmbientLight(0xffffff, 1.1));
    const sol = new THREE.DirectionalLight(0xffffff, 2.2);
    sol.position.set(-0.6, 0.8, 1);
    camera.add(sol);

    // Globo
    const matGlobo = new THREE.MeshPhongMaterial({ color: C.oceano, shininess: 14, specular: 0x1d3a55 });
    cena.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), matGlobo));
    cena.add(new THREE.Mesh(new THREE.SphereGeometry(1.0015, 96, 64), borda()));
    cena.add(new THREE.Mesh(new THREE.SphereGeometry(1.12, 96, 64), atmosfera()));

    // Estrelas
    const nEstrelas = 900;
    const posEstrelas = new Float32Array(nEstrelas * 3);
    for (let i = 0; i < nEstrelas; i++) {
      new THREE.Vector3().randomDirection().multiplyScalar(40).toArray(posEstrelas, i * 3);
    }
    const geoEstrelas = new THREE.BufferGeometry();
    geoEstrelas.setAttribute("position", new THREE.BufferAttribute(posEstrelas, 3));
    const matEstrelas = new THREE.PointsMaterial({ color: 0xc9dcf0, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.6 });
    cena.add(new THREE.Points(geoEstrelas, matEstrelas));

    const descartar: { dispose(): void }[] = [geoEstrelas, matEstrelas];
    let vivo = true;
    fetch("/data/paises-50m.json")
      .then((r) => r.json())
      .then((topo: Topology) => {
        if (!vivo) return;
        const W = renderer.capabilities.maxTextureSize >= 4096 ? 4096 : 2048;
        const tex = new THREE.CanvasTexture(desenharMapa(topo, [origem, destino], W));
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        matGlobo.map = tex;
        matGlobo.color.set(0xffffff);
        matGlobo.needsUpdate = true;
        descartar.push(tex);
      })
      .catch(() => {});

    // Rota
    const a = vetor(origem);
    const b = vetor(destino);
    const angulo = a.angleTo(b);
    const km = angulo * KM_RAIO;
    const voo = km / KM_POR_MIN + MIN_SOLO; // duração estimada, min
    const altura = Math.max(0.02, angulo * 0.35);
    const pts = arco(a, b, altura);
    const curva = new THREE.CatmullRomCurve3(pts);
    const seg = pts.length - 1;
    const radial = 6;

    const distCam = 1 + Math.min(Math.max(angulo * 4.5, 0.8), 2.0);
    const escala = Math.min((distCam - 1) * 0.045, Math.max(angulo * 0.15, 0.014));

    const tuboFundo = new THREE.TubeGeometry(curva, seg, escala * 0.05, radial, false);
    const matFundo = new THREE.MeshBasicMaterial({ color: C.rota, transparent: true, opacity: 0.22 });
    cena.add(new THREE.Mesh(tuboFundo, matFundo));
    const tuboRastro = new THREE.TubeGeometry(curva, seg, escala * 0.09, radial, false);
    const matRastro = new THREE.MeshBasicMaterial({ color: C.rota });
    cena.add(new THREE.Mesh(tuboRastro, matRastro));
    tuboRastro.setDrawRange(0, 0);
    descartar.push(tuboFundo, matFundo, tuboRastro, matRastro);

    // Aeroportos (pista no sentido da rota) e o anel que pulsa enquanto o avião espera no solo
    const farois: THREE.Mesh[] = [];
    const escalaAeroporto = escala * 1.1;
    for (const [v, rumo] of [
      [a, b.clone().sub(a)],
      [b, b.clone().sub(a)],
    ] as const) {
      const { grupo, farol } = aeroporto();
      assentar(grupo, v, rumo);
      grupo.scale.setScalar(escalaAeroporto);
      cena.add(grupo);
      farois.push(farol);
    }
    const geoAnel = new THREE.RingGeometry(escalaAeroporto * 1.45, escalaAeroporto * 1.55, 64);
    const matAnel = new THREE.MeshBasicMaterial({ color: C.atraso, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const anel = new THREE.Mesh(geoAnel, matAnel);
    anel.position.copy(a.clone().multiplyScalar(1.002));
    anel.lookAt(a.clone().multiplyScalar(2));
    anel.visible = false;
    cena.add(anel);
    descartar.push(geoAnel, matAnel);

    const halo = texturaHalo();
    descartar.push(halo);
    const real = aviao(new THREE.Color(corAviao).getHex(), 1, halo);
    const fantasma = aviao(C.fantasma, 0.45);
    real.scale.setScalar(escala * 1.7);
    fantasma.scale.setScalar(escala * 1.7);
    cena.add(real, fantasma);

    // Câmera olhando o meio da rota
    const meio = a.clone().add(b).normalize();
    camera.position.copy(meio.clone().multiplyScalar(distCam));
    camera.lookAt(meio.clone().multiplyScalar(0.9));
    const controles = new OrbitControls(camera, renderer.domElement);
    controles.target.copy(meio.clone().multiplyScalar(0.9));
    controles.enablePan = false;
    controles.enableDamping = true;
    controles.minDistance = 0.2; // medido a partir do alvo (perto da superfície)
    controles.maxDistance = 3.5;
    controles.rotateSpeed = 0.5;

    const tmp = new THREE.Vector3();
    function posicionar(obj: THREE.Object3D, t: number) {
      const u = THREE.MathUtils.clamp(t, 0, 1);
      curva.getPointAt(u, obj.position);
      obj.up.copy(obj.position).normalize();
      obj.position.addScaledVector(obj.up, escala * 0.12);
      tmp.copy(obj.position).add(curva.getTangentAt(u));
      obj.lookAt(tmp);
    }

    // Linha do tempo em minutos simulados: o fantasma sai no horário; o avião real sai depois do atraso.
    const total = espera + voo;
    const segundos = THREE.MathUtils.clamp(total / 12, 6, 14);
    const ANTES = 0.8; // s parado antes de começar
    const DEPOIS = 2.5; // s parado no fim antes de repetir
    const facil = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

    function quadro(s: number) {
      const min = THREE.MathUtils.clamp((s - ANTES) / segundos, 0, 1) * total;
      const tFantasma = facil(Math.min(min / voo, 1));
      const tReal = facil(THREE.MathUtils.clamp((min - espera) / voo, 0, 1));
      posicionar(fantasma, tFantasma);
      posicionar(real, tReal);
      fantasma.visible = atrasou && tFantasma < 1;
      tuboRastro.setDrawRange(0, Math.floor(tReal * seg) * radial * 6);

      const esperando = atrasou && min > 0 && min < espera;
      anel.visible = esperando;
      if (esperando) {
        const pulso = (s * 1.4) % 1;
        anel.scale.setScalar(1 + pulso * 2.2);
        matAnel.opacity = 0.9 * (1 - pulso);
      }

      const aceso = s % 1.2 < 0.25;
      for (const f of farois) f.visible = aceso;

      const { relogio, status } = hud.current;
      if (relogio) relogio.textContent = hhmm(horario, min);
      if (status) {
        status.textContent =
          min <= 0
            ? `Partida prevista às ${horario}`
            : esperando
              ? `Ainda no solo: +${Math.round(min)} min de atraso`
              : tReal < 1
                ? atrasou
                  ? `Decolou com ${espera} min de atraso`
                  : "Em voo, no horário"
                : `Chegou por volta das ${hhmm(horario, espera + voo)}${atrasou ? ` (${espera} min depois do previsto)` : ""}`;
      }
    }

    function rotular() {
      const w = renderer.domElement.clientWidth;
      const h = renderer.domElement.clientHeight;
      const dirCam = camera.position.clone().normalize();
      [a, b].forEach((v, i) => {
        const r = rotulos.current[i];
        if (!r) return;
        const p = v.clone().project(camera);
        r.style.transform = `translate(${((p.x + 1) / 2) * w}px, ${((1 - p.y) / 2) * h}px)`;
        r.style.opacity = v.clone().normalize().dot(dirCam) > 0.15 ? "1" : "0";
      });
    }

    function redimensionar() {
      const { clientWidth: w, clientHeight: h } = el!;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(redimensionar);
    ro.observe(el);
    redimensionar();

    let raf = 0;
    let visivel = true;
    const io = new IntersectionObserver(([e]) => (visivel = e.isIntersecting));
    io.observe(el);
    const inicio = performance.now();
    const ciclo = ANTES + segundos + DEPOIS;

    function loop() {
      raf = requestAnimationFrame(loop);
      if (!visivel) return;
      const s = reduzir ? ciclo - DEPOIS : ((performance.now() - inicio) / 1000) % ciclo;
      quadro(s);
      controles.update();
      rotular();
      renderer.render(cena, camera);
    }
    loop();

    return () => {
      vivo = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      controles.dispose();
      cena.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Sprite) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      descartar.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [origem, destino, horario, espera, atrasou, corAviao, rodada]);

  return (
    <div className="overflow-hidden rounded-lg bg-painel text-painel-texto">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-3">
        <p className="font-cond text-lg font-semibold">
          <span ref={(r) => void (hud.current.relogio = r)} className="mr-3 tabular-nums text-sinal">
            {horario}
          </span>
          <span ref={(r) => void (hud.current.status = r)} aria-live="off" />
        </p>
        <button
          type="button"
          onClick={() => setRodada((n) => n + 1)}
          className="rounded border border-white/20 px-2.5 py-0.5 text-sm text-white/80 hover:bg-white/10"
        >
          Repetir
        </button>
      </div>
      <div ref={caixa} className="relative h-[28rem] w-full cursor-grab active:cursor-grabbing sm:h-[40rem]" role="img"
        aria-label={`Animação do voo de ${siglaOrigem} para ${siglaDestino}${atrasou ? `, saindo ${espera} min atrasado` : ", no horário"}`}>
        {[siglaOrigem, siglaDestino].map((s, i) => (
          <span
            key={s + i}
            ref={(r) => void (rotulos.current[i] = r)}
            className={`pointer-events-none absolute left-0 top-0 font-cond text-sm font-semibold transition-opacity ${i ? "-translate-y-11" : "translate-y-6"}`}
          >
            <span className="relative -left-1/2 rounded bg-black/50 px-1.5 py-0.5">{s}</span>
          </span>
        ))}
      </div>
      <ul className="flex flex-wrap gap-4 px-4 pb-3 text-xs text-white/70">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: corAviao }} />
          Avião real
        </li>
        {atrasou && (
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[#9aa8b5]/60" />
            Se tivesse saído no horário
          </li>
        )}
        <li>Duração do voo estimada pela distância. Arraste para girar o globo.</li>
      </ul>
    </div>
  );
}
