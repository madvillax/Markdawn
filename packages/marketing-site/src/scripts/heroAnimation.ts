type AgentMotion = {
  branch: SVGGElement;
  path: SVGPathElement;
  signal: SVGCircleElement;
  halo: SVGCircleElement;
  orbit: HTMLElement;
  card: HTMLElement;
  output: HTMLElement;
  message: string;
  rootX: number;
  x: number;
  y: number;
  homePath: string;
};

const clampUnit = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => {
  const t = clampUnit(value);
  return t * t * (3 - 2 * t);
};

export function initializeHeroAnimation(scene: HTMLElement): () => void {
  const canvas = scene.querySelector<HTMLElement>('.collaboration-canvas');
  const source = scene.querySelector<SVGPathElement>('[data-source-route]');
  const sourceSignal = scene.querySelector<SVGCircleElement>('[data-source-signal]');
  const sourceHalo = scene.querySelector<SVGCircleElement>('[data-source-halo]');
  if (!canvas || !source || !sourceSignal || !sourceHalo) return () => {};
  const agents: AgentMotion[] = [];
  scene.querySelectorAll<HTMLElement>('[data-agent-node]').forEach((node) => {
    const branch = scene.querySelector<SVGGElement>(
      `[data-agent-branch="${node.dataset.agentNode}"]`,
    );
    const path = branch?.querySelector<SVGPathElement>('[data-branch-path]');
    const signal = branch?.querySelector<SVGCircleElement>('[data-branch-signal]');
    const halo = branch?.querySelector<SVGCircleElement>('[data-branch-halo]');
    const orbit = node.querySelector<HTMLElement>('[data-agent-orbit]');
    const card = node.querySelector<HTMLElement>('[data-agent-card]');
    const output = node.querySelector<HTMLElement>('[data-agent-output]');
    if (!branch || !path || !signal || !halo || !orbit || !card || !output) return;
    agents.push({
      branch,
      path,
      signal,
      halo,
      orbit,
      card,
      output,
      message: output.textContent ?? '',
      rootX: Number(branch.dataset.branchX),
      x: Number(node.dataset.agentX),
      y: Number(node.dataset.agentY),
      homePath: path.getAttribute('d') ?? '',
    });
  });
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const abort = new AbortController();
  let frame = 0;
  let elapsed = 0;
  let previous = 0;
  let visible = false;
  let paused = false;
  const pauseButton = document.querySelector<HTMLButtonElement>('[data-hero-pause]');
  let scale = canvas.clientWidth / 1100;
  let compact = canvas.clientWidth <= 560;
  const sourceLength = source.getTotalLength();
  const workspace = document.querySelector<HTMLElement>('[data-markdown-demo]');
  const lines = [...(workspace?.querySelectorAll<HTMLElement>('[data-writing-line]') ?? [])];
  const lineMessages = lines.map((line) => line.dataset.writingLine ?? '');
  const alternateMessages = lines.map(
    (line, index) => line.dataset.writingAlternate ?? lineMessages[index] ?? '',
  );
  let writingStep = -1;
  let lastWrittenLine = -1;
  let lastWrittenMessage = '';
  const author = workspace?.querySelector<HTMLElement>('[data-current-writer]');
  const writerImage = workspace?.querySelector<HTMLImageElement>('[data-writer-image]');
  const connector = document.querySelector<SVGSVGElement>('[data-workspace-connection]');
  const connectorPath = connector?.querySelector<SVGPathElement>('[data-workspace-path]');
  const connectorBeam = connector?.querySelector<SVGPathElement>('[data-workspace-beam]');
  const connectorSignal = connector?.querySelector<SVGCircleElement>('[data-workspace-signal]');
  const connectorHalo = connector?.querySelector<SVGCircleElement>('[data-workspace-halo]');
  let connectorLength = 0;
  const page = scene.closest<HTMLElement>('.page-shell');

  // Keep the route steady while the blue thought travels down it into the editor.
  const resize = (): void => {
    scale = canvas.clientWidth / 1100;
    compact = canvas.clientWidth <= 560;
    agents.forEach((agent) => {
      const logo = agent.orbit.querySelector<HTMLElement>('.agent-logo');
      if (compact && logo) {
        agent.card.style.top = `${-agent.y * scale + logo.offsetHeight / 2 - 52}px`;
        agent.card.style.bottom = 'auto';
      } else {
        agent.card.style.removeProperty('top');
        agent.card.style.removeProperty('bottom');
      }
    });
    const windowElement = workspace?.closest<HTMLElement>('.workspace-window');
    if (!connector || !connectorPath || !page || !windowElement) return;
    const parent = page.getBoundingClientRect();
    const from = canvas.getBoundingClientRect();
    const to = windowElement.getBoundingClientRect();
    const startX = from.left - parent.left + 880 * scale;
    const startY = from.top - parent.top + 135 * scale;
    const endX = to.right - parent.left - 20;
    const endY = to.top - parent.top;
    const sideX = Math.min(
      parent.width - 12,
      Math.max(from.right - parent.left + 14, to.right - parent.left + 24),
    );
    connector.style.height = `${endY + 2}px`;
    connector.setAttribute('viewBox', `0 0 ${parent.width} ${endY + 2}`);
    connectorPath.setAttribute(
      'd',
      `M${startX} ${startY} H${sideX - 18} Q${sideX} ${startY} ${sideX} ${startY + 18} V${endY - 24} Q${sideX} ${endY - 8} ${sideX - 16} ${endY - 8} H${endX + 8} Q${endX} ${endY - 8} ${endX} ${endY}`,
    );
    connectorBeam?.setAttribute('d', connectorPath.getAttribute('d') ?? '');
    connectorLength = connectorPath.getTotalLength();
  };
  const moveSignal = (
    path: SVGPathElement,
    length: number,
    signal: SVGCircleElement,
    halo: SVGCircleElement,
    progress: number,
    opacity: number,
  ): void => {
    const point = path.getPointAtLength(clampUnit(progress) * length);
    const transform = `translate(${point.x}px, ${point.y}px)`;
    signal.style.transform = transform;
    halo.style.transform = transform;
    signal.style.opacity = String(opacity);
    halo.style.opacity = String(opacity * 0.32);
  };
  const moveBeam = (
    path: SVGPathElement,
    length: number,
    progress: number,
    opacity: number,
  ): void => {
    path.style.strokeDasharray = `36 ${length}`;
    path.style.strokeDashoffset = String(36 - clampUnit(progress) * length);
    path.style.opacity = String(opacity);
  };
  const reset = (): void => {
    sourceSignal.style.opacity = '0';
    sourceHalo.style.opacity = '0';
    source.style.opacity = '0';
    if (connectorSignal) connectorSignal.style.opacity = '0';
    if (connectorHalo) connectorHalo.style.opacity = '0';
    if (connectorBeam) connectorBeam.style.opacity = '0';
    writingStep = -1;
    lastWrittenLine = -1;
    agents.forEach((agent) => {
      agent.branch.style.transform = '';
      agent.path.style.stroke = '';
      agent.path.setAttribute('d', agent.homePath);
      agent.path.classList.remove('is-generating');
      agent.orbit.style.transform = '';
      agent.orbit.parentElement?.style.removeProperty('z-index');
      agent.card.style.opacity = '0';
      agent.signal.style.opacity = '0';
      agent.halo.style.opacity = '0';
      agent.output.textContent = agent.message;
    });
    lines.forEach((line, index) => {
      line.textContent = lineMessages[index] ?? '';
      line.removeAttribute('data-writing');
    });
    if (author) author.textContent = 'Shared page';
  };
  const stop = (): void => {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
  };
  const step = (time: number): void => {
    frame = 0;
    if (motion.matches || paused || document.hidden || !visible) return;
    if (previous) elapsed += Math.min(time - previous, 64);
    previous = time;
    const phase = (elapsed % 6600) / 1000;
    const rayPhase = (elapsed % 3800) / 1000;
    const sourceProgress = rayPhase / 1.35;
    const sourceOpacity = rayPhase < 1.35 ? 1 : 0;
    moveSignal(source, sourceLength, sourceSignal, sourceHalo, sourceProgress, sourceOpacity);
    moveBeam(source, sourceLength, sourceProgress, sourceOpacity);
    if (connectorPath && connectorSignal && connectorHalo && connectorBeam && connectorLength) {
      const progress = (rayPhase - 1.35) / 2.3;
      const opacity = rayPhase >= 1.35 && rayPhase < 3.65 ? 1 : 0;
      moveSignal(connectorPath, connectorLength, connectorSignal, connectorHalo, progress, opacity);
      moveBeam(connectorBeam, connectorLength, progress, opacity);
    }
    agents.forEach((agent, index) => {
      const local = phase - (0.24 + index * 0.72);
      const generation = local - 0.38;
      const opacity = smooth(generation / 0.1) * (1 - smooth((generation - 0.58) / 0.12));
      const intro = smooth(elapsed / 1200);
      const angle = (elapsed / 9200) * Math.PI * 2 - index * 0.48;
      const radius = Math.min(120, Math.max(65, Math.abs(agent.y - 135)));
      const side = agent.y < 135 ? -1 : 1;
      const desiredX = agent.x + Math.sin(angle) * 48 * side * intro;
      // Leave room for the final agent's label on narrow screens.
      const deltaX = Math.min(desiredX, compact ? 1030 : 1100) - agent.x;
      const deltaY = (135 + Math.cos(angle) * radius * side - agent.y) * intro;
      const endX = agent.x + deltaX;
      const endY = agent.y + deltaY;
      const bend = Math.sin(angle) * 32 * intro;
      const reach = endX - agent.rootX;
      // Bend the ribbon itself rather than rotating a rigid branch.
      agent.path.setAttribute(
        'd',
        `M${agent.rootX} 135 C${agent.rootX + reach * 0.4} ${135 + bend} ${endX - 80} ${endY - bend} ${endX - 28} ${endY}`,
      );
      agent.orbit.style.transform = `translate3d(${deltaX * scale}px, ${deltaY * scale}px, 0)`;
      if (agent.orbit.parentElement)
        agent.orbit.parentElement.style.zIndex = String(10 + Math.round(Math.sin(angle) * 5));
      agent.card.style.opacity = String(opacity);
      agent.card.style.transform = `translateY(${(1 - opacity) * 6 - (compact ? deltaY * scale : 0)}px) scale(${0.96 + opacity * 0.04})`;
      agent.path.style.stroke = opacity > 0.05 ? '#3b82f6' : '';
      agent.path.classList.toggle('is-generating', opacity > 0.05);
      if (local >= 0 && local < 0.38) {
        moveSignal(
          agent.path,
          agent.path.getTotalLength(),
          agent.signal,
          agent.halo,
          local / 0.38,
          1,
        );
      } else {
        agent.signal.style.opacity = '0';
        agent.halo.style.opacity = '0';
      }
      const text = agent.message.slice(
        0,
        Math.ceil(clampUnit(generation / 0.55) * agent.message.length),
      );
      if (agent.output.textContent !== text) agent.output.textContent = text;
    });

    // Hand off immediately to the next contributor. Completed lines remain in
    // place while the next pass edits them, so there is no blank reset or idle hold.
    const nextWritingStep = Math.floor(elapsed / 1900);
    const current = nextWritingStep % Math.max(1, lines.length);
    const round = Math.floor(nextWritingStep / Math.max(1, lines.length));
    const message = (round % 2 === 0 ? lineMessages[current] : alternateMessages[current]) ?? '';
    if (nextWritingStep !== writingStep) {
      const previousLine = lines[lastWrittenLine];
      if (previousLine) previousLine.textContent = lastWrittenMessage;
      writingStep = nextWritingStep;
      lastWrittenLine = current;
      lastWrittenMessage = message;
    }
    const progress = (elapsed % 1900) / 1900;
    lines.forEach((line, index) => {
      if (index === current) {
        const text = message.slice(0, Math.ceil(progress * message.length));
        if (line.textContent !== text) line.textContent = text;
        line.dataset.writing = 'true';
      } else line.removeAttribute('data-writing');
    });
    const writer =
      current % 3 === 0
        ? 'You are writing'
        : current % 3 === 1
          ? 'Claude is writing'
          : 'ChatGPT is writing';
    if (author && author.textContent !== writer) author.textContent = writer;
    const image =
      current % 3 === 0
        ? '/metakip-mark.png'
        : current % 3 === 1
          ? '/agents/claude.svg'
          : '/agents/chatgpt.svg';
    if (writerImage && writerImage.getAttribute('src') !== image) writerImage.src = image;
    frame = requestAnimationFrame(step);
  };
  const wake = (): void => {
    if (!frame && visible && !paused && !document.hidden && !motion.matches)
      frame = requestAnimationFrame(step);
  };
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) visibility.set(entry.target, entry.isIntersecting);
    visible = [...visibility.values()].some(Boolean);
    if (visible) wake();
    else stop();
  });
  const visibility = new Map<Element, boolean>();
  observer.observe(scene);
  if (workspace) observer.observe(workspace);
  const resizer = new ResizeObserver(resize);
  resizer.observe(canvas);
  if (page) resizer.observe(page);
  const updateMotion = (): void => {
    stop();
    if (motion.matches) reset();
    else wake();
  };
  motion.addEventListener('change', updateMotion, { signal: abort.signal });
  pauseButton?.addEventListener(
    'click',
    () => {
      paused = !paused;
      pauseButton.setAttribute('aria-pressed', String(paused));
      pauseButton.textContent = paused ? 'Play animation' : 'Pause animation';
      if (paused) stop();
      else wake();
    },
    { signal: abort.signal },
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) stop();
      else wake();
    },
    { signal: abort.signal },
  );
  resize();
  reset();
  return () => {
    stop();
    abort.abort();
    observer.disconnect();
    resizer.disconnect();
    reset();
  };
}
