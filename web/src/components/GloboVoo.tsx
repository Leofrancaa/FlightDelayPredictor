"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type LatLon = [lat: number, lon: number];

/** Paleta fixa do painel escuro (mesma do painel de partidas). */
const C = {
  oceano: 0x0f1a26,
  atmosfera: 0x2a78d6,
  terra: 0x3a4b5c,
  brasil: 0x7f93a7,
  rota: 0xf2b705,
  real: 0xffffff,
  atraso: 0xe55a4c,
  fantasma: 0x9aa8b5,
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

function aviao(cor: number, opacidade = 1) {
  const mat = new THREE.MeshBasicMaterial({ color: cor, transparent: opacidade < 1, opacity: opacidade });
  const g = new THREE.Group();
  const fuselagem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 1, 10), mat);
  fuselagem.rotation.x = Math.PI / 2;
  const nariz = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.25, 10), mat);
  nariz.rotation.x = Math.PI / 2;
  nariz.position.z = 0.62;
  const asa = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.22), mat);
  asa.position.z = 0.08;
  const cauda = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.12), mat);
  cauda.position.z = -0.42;
  const deriva = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.14), mat);
  deriva.position.set(0, 0.1, -0.42);
  g.add(fuselagem, nariz, asa, cauda, deriva);
  return g;
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

    // Globo
    cena.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshBasicMaterial({ color: C.oceano })));
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.06, 64, 48),
      new THREE.MeshBasicMaterial({ color: C.atmosfera, transparent: true, opacity: 0.08, side: THREE.BackSide }),
    );
    cena.add(halo);

    const descartar: { dispose(): void }[] = [];
    let vivo = true;
    fetch("/data/globo.json")
      .then((r) => r.json())
      .then(({ terra, brasil, eua = [] }: { terra: number[]; brasil: number[]; eua?: number[] }) => {
        if (!vivo) return;
        for (const [lista, cor, tam] of [
          [terra, C.terra, 0.012],
          [brasil, C.brasil, 0.009],
          [eua, C.brasil, 0.009],
        ] as const) {
          const pos = new Float32Array((lista.length / 2) * 3);
          for (let i = 0; i < lista.length; i += 2) {
            vetor([lista[i] / 10, lista[i + 1] / 10], 1.001).toArray(pos, (i / 2) * 3);
          }
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
          const mat = new THREE.PointsMaterial({ color: cor, size: tam, sizeAttenuation: true });
          descartar.push(geo, mat);
          cena.add(new THREE.Points(geo, mat));
        }
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

    const distCam = 1 + Math.min(Math.max(angulo * 4.5, 1.1), 2.0);
    const escala = Math.min((distCam - 1) * 0.045, Math.max(angulo * 0.15, 0.014));

    const tuboFundo = new THREE.TubeGeometry(curva, seg, escala * 0.05, radial, false);
    const matFundo = new THREE.MeshBasicMaterial({ color: C.rota, transparent: true, opacity: 0.22 });
    cena.add(new THREE.Mesh(tuboFundo, matFundo));
    const tuboRastro = new THREE.TubeGeometry(curva, seg, escala * 0.09, radial, false);
    const matRastro = new THREE.MeshBasicMaterial({ color: C.rota });
    cena.add(new THREE.Mesh(tuboRastro, matRastro));
    tuboRastro.setDrawRange(0, 0);
    descartar.push(tuboFundo, matFundo, tuboRastro, matRastro);

    // Aeroportos e o anel que pulsa enquanto o avião espera no solo
    const geoPonto = new THREE.SphereGeometry(escala * 0.22, 16, 12);
    const matPonto = new THREE.MeshBasicMaterial({ color: C.real });
    for (const v of [a, b]) {
      const m = new THREE.Mesh(geoPonto, matPonto);
      m.position.copy(v);
      cena.add(m);
    }
    const geoAnel = new THREE.RingGeometry(escala * 0.7, escala * 0.76, 48);
    const matAnel = new THREE.MeshBasicMaterial({ color: C.atraso, transparent: true, side: THREE.DoubleSide });
    const anel = new THREE.Mesh(geoAnel, matAnel);
    anel.position.copy(a.clone().multiplyScalar(1.002));
    anel.lookAt(a.clone().multiplyScalar(2));
    anel.visible = false;
    cena.add(anel);
    descartar.push(geoPonto, matPonto, geoAnel, matAnel);

    const real = aviao(new THREE.Color(corAviao).getHex());
    const fantasma = aviao(C.fantasma, 0.45);
    real.scale.setScalar(escala);
    fantasma.scale.setScalar(escala);
    cena.add(real, fantasma);

    // Câmera olhando o meio da rota, um pouco ao sul para mostrar o Brasil
    const meio = a.clone().add(b).normalize();
    camera.position.copy(meio.clone().multiplyScalar(distCam)).add(new THREE.Vector3(0, -0.08 * distCam, 0));
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
      obj.position.addScaledVector(obj.up, escala * 0.08);
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
        if (o instanceof THREE.Mesh) {
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
            className={`pointer-events-none absolute left-0 top-0 font-cond text-sm font-semibold transition-opacity ${i ? "-translate-y-7" : "translate-y-2"}`}
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
