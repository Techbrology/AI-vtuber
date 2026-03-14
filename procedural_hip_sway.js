export function createProceduralHipSway(THREE) {
  const tmpEuler = new THREE.Euler();
  const tmpQuat = new THREE.Quaternion();
  const tmpVec = new THREE.Vector3();

  let state = null;
  let basePose = null;
  let getBoneNode = null;

  function setContext(ctx) {
    state = ctx.state;
    basePose = ctx.basePose;
    getBoneNode = ctx.getBoneNode;
  }

  function syncBasePose() {
    // No cached state needed, but keep the hook for consistency.
  }

  function applyBoneOffset(name, x, y, z) {
    const node = getBoneNode(name);
    const base = basePose.get(name);
    if (!node || !base) return;
    tmpEuler.set(x, y, z, "XYZ");
    tmpQuat.setFromEuler(tmpEuler);
    node.quaternion.copy(base.quat).multiply(tmpQuat);
  }

  function applyBonePositionOffset(name, x, y, z) {
    const node = getBoneNode(name);
    const base = basePose.get(name);
    if (!node || !base) return;
    tmpVec.set(x, y, z);
    node.position.copy(base.pos).add(tmpVec);
  }

  function update(t) {
    if (!state || !basePose || basePose.size === 0) return;
    if (!state.hipSwayEnabled) return;

    const hI = state.hipSwayIntensity;
    const hS = state.hipSwaySpeed;
    const hipSway = Math.sin(t * hS * 0.8);
    const hipSway2 = Math.sin(t * hS * 1.15 + 1.1);
    const hipLift = Math.sin(t * hS * 0.5 + 0.7);
    const footLock = state.proceduralFootLock;
    const hipPosScale = footLock ? 0 : 1;
    const hipRotScale = footLock ? 0.25 : 1;

    const hipSide = 0.018 * hI * hipSway * hipPosScale;
    const hipUp = 0.008 * hI * hipLift * hipPosScale;
    const hipFwd = 0.012 * hI * hipSway2 * hipPosScale;

    applyBonePositionOffset("hips", hipSide, hipUp, hipFwd);
    applyBoneOffset(
      "hips",
      0.015 * hI * hipSway2 * hipRotScale,
      0.06 * hI * hipSway * hipRotScale,
      0.02 * hI * hipSway2 * hipRotScale
    );
  }

  return {
    setContext,
    syncBasePose,
    update,
  };
}
