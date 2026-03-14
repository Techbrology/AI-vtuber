export function createProceduralSpeaking(THREE) {
  const tmpEuler = new THREE.Euler();
  const tmpQuat = new THREE.Quaternion();

  let state = null;
  let basePose = null;
  let getBoneNode = null;

  let nextPhonemeTime = 0;
  let currentPhoneme = "aa";
  let phonemeBlend = {
    aa: 0,
    ih: 0,
    ee: 0,
    oh: 0,
    ou: 0,
  };


  function setContext(ctx) {
    state = ctx.state;
    basePose = ctx.basePose;
    getBoneNode = ctx.getBoneNode;
  }

  function syncBasePose() {
    // No cached pose yet, but reserved for future use.
  }

  function choosePhoneme() {
    const roll = Math.random();
    if (roll < 0.25) return "aa";
    if (roll < 0.45) return "ee";
    if (roll < 0.6) return "ih";
    if (roll < 0.8) return "oh";
    return "ou";
  }

  function applyAdditiveRotation(name, x, y, z, mix) {
    const node = getBoneNode(name);
    if (!node) return;
    tmpEuler.set(x, y, z, "XYZ");
    tmpQuat.setFromEuler(tmpEuler);
    const target = node.quaternion.clone().multiply(tmpQuat);
    node.quaternion.slerp(target, mix);
  }

  function update(t, dt) {
    if (!state || !basePose || basePose.size === 0) return null;

    const rate = Math.max(state.speakingRate, 0.05);
    if (t >= nextPhonemeTime) {
      currentPhoneme = choosePhoneme();
      nextPhonemeTime = t + (0.18 + Math.random() * 0.25) / rate;
    }

    const smoothing = 1 - Math.exp(-dt * (6 + rate * 6));
    const open = state.speakingMouthOpen + state.speakingIntensity * 0.7;
    for (const key of Object.keys(phonemeBlend)) {
      const target = key === currentPhoneme ? open : 0;
      phonemeBlend[key] += (target - phonemeBlend[key]) * smoothing;
    }

    const smile = state.speakingSmile * Math.min(1, state.speakingIntensity);

    // Speaking sway: subtle upper-body motion instead of arm gestures.
    const armRate = Math.max(state.speakingArmSpeed, 0.2);
    const g = state.speakingArmGesture * state.speakingIntensity;
    const sway = Math.sin(t * armRate);
    const sway2 = Math.sin(t * armRate * 0.6 + 1.4);
    const mix = 1 - Math.exp(-dt * 6);

    applyAdditiveRotation("spine", 0.01 * g * sway2, 0.02 * g * sway, 0.005 * g * sway, mix);
    applyAdditiveRotation("chest", 0.015 * g * sway2, 0.03 * g * sway, 0.01 * g * sway, mix);
    applyAdditiveRotation("upperChest", 0.01 * g * sway2, 0.02 * g * sway, 0.008 * g * sway, mix);
    applyAdditiveRotation("neck", 0.012 * g * sway, 0.02 * g * sway2, 0.01 * g * sway2, mix);
    applyAdditiveRotation("head", 0.02 * g * sway2, 0.03 * g * sway, 0.015 * g * sway2, mix);

    return {
      aa: phonemeBlend.aa,
      ih: phonemeBlend.ih,
      ee: phonemeBlend.ee,
      oh: phonemeBlend.oh,
      ou: phonemeBlend.ou,
      joy: smile,
    };
  }

  return {
    setContext,
    syncBasePose,
    update,
  };
}
