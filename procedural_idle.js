export function createProceduralIdle(THREE) {
  const SPRING_BONES = [
    "leftUpperArm",
    "leftLowerArm",
    "leftHand",
    "rightUpperArm",
    "rightLowerArm",
    "rightHand",
  ];

  const tmpEuler = new THREE.Euler();
  const tmpQuat = new THREE.Quaternion();
  const tmpVec = new THREE.Vector3();

  let state = null;
  let basePose = null;
  let getBoneNode = null;

  const springTargets = new Map();
  const springStates = new Map();
  let activityLevel = 0.4;
  let activityTarget = 0.4;
  let nextActivityTime = 0;

  function setContext(ctx) {
    state = ctx.state;
    basePose = ctx.basePose;
    getBoneNode = ctx.getBoneNode;
  }

  function syncBasePose() {
    if (!getBoneNode) return;
    springTargets.clear();
    springStates.clear();
    for (const name of SPRING_BONES) {
      const node = getBoneNode(name);
      if (!node) continue;
      springStates.set(name, {
        quat: node.quaternion.clone(),
        vel: new THREE.Vector3(),
      });
    }
  }

  function applyBoneOffset(name, x, y, z) {
    const node = getBoneNode(name);
    const base = basePose.get(name);
    if (!node || !base) return;
    tmpEuler.set(x, y, z, "XYZ");
    tmpQuat.setFromEuler(tmpEuler);
    node.quaternion.copy(base.quat).multiply(tmpQuat);
  }

  function computeBoneQuat(name, x, y, z) {
    const base = basePose.get(name);
    if (!base) return null;
    tmpEuler.set(x, y, z, "XYZ");
    const q = new THREE.Quaternion().setFromEuler(tmpEuler);
    return base.quat.clone().multiply(q);
  }

  function setSpringTarget(name, quat) {
    if (!quat) return;
    springTargets.set(name, quat);
  }

  function updateSprings(dt) {
    if (!state.springEnabled) {
      springTargets.clear();
      return;
    }
    for (const name of SPRING_BONES) {
      const target = springTargets.get(name);
      if (!target) continue;
      const node = getBoneNode(name);
      if (!node) continue;
      const st =
        springStates.get(name) ||
        (() => {
          const s = { quat: node.quaternion.clone(), vel: new THREE.Vector3() };
          springStates.set(name, s);
          return s;
        })();

      const inv = st.quat.clone().invert();
      const delta = inv.multiply(target);
      if (delta.w < 0) {
        delta.x *= -1;
        delta.y *= -1;
        delta.z *= -1;
        delta.w *= -1;
      }
      const angle = 2 * Math.acos(THREE.MathUtils.clamp(delta.w, -1, 1));
      if (angle > 1e-4) {
        const axis = new THREE.Vector3(delta.x, delta.y, delta.z).normalize();
        const error = axis.multiplyScalar(angle);
        st.vel.addScaledVector(error, state.springStiffness * dt);
      }
      st.vel.multiplyScalar(Math.exp(-state.springDamping * dt));

      const speed = st.vel.length();
      if (speed > 1e-5) {
        const axis = st.vel.clone().normalize();
        const dq = new THREE.Quaternion().setFromAxisAngle(axis, speed * dt);
        st.quat.multiply(dq).normalize();
      }
      node.quaternion.copy(st.quat);
    }
    springTargets.clear();
  }

  function applyBonePositionOffset(name, x, y, z) {
    const node = getBoneNode(name);
    const base = basePose.get(name);
    if (!node || !base) return;
    tmpVec.set(x, y, z);
    node.position.copy(base.pos).add(tmpVec);
  }

  function fract(x) {
    return x - Math.floor(x);
  }

  function hash(n) {
    return fract(Math.sin(n) * 43758.5453123);
  }

  function updateActivity(t, dt) {
    if (t > nextActivityTime) {
      const r = hash(Math.floor(t * 10.0) + 0.3);
      const r2 = hash(Math.floor(t * 10.0) + 2.1);
      const idleBias = state.proceduralIdleBias;
      const low = 0.15 + 0.25 * r;
      const high = 0.55 + 0.6 * r2;
      activityTarget = r < idleBias ? low : high;
      const rate = state.proceduralBurstRate;
      const hold = THREE.MathUtils.lerp(5.0, 1.2, Math.min(rate / 2.5, 1));
      nextActivityTime = t + hold;
    }
    const smooth = 1 - Math.exp(-dt * 2.2);
    activityLevel += (activityTarget - activityLevel) * smooth;
    return activityLevel;
  }

  function update(t, dt) {
    if (!state || !basePose || basePose.size === 0) return;
    if (!state.proceduralEnabled) return;

    const i = state.proceduralIntensity;
    const s = state.proceduralSpeed;
    const armRelax = state.proceduralArmRelax;
    const armForward = state.proceduralArmForward;
    const armDown = state.proceduralArmDown;
    const elbowBend = state.proceduralElbowBend;
    const headTilt = state.proceduralHeadTilt;
    const weightShift = state.proceduralWeightShift;

    const activity = updateActivity(t, dt);
    const baseSway = Math.sin(t * s * 0.6);
    const baseSway2 = Math.sin(t * s * 0.9 + 1.4);
    const breath = Math.sin(t * s * 1.2);

    const sway = baseSway * (0.25 + 0.75 * activity);
    const sway2 = baseSway2 * (0.25 + 0.75 * activity);

    const footLock = state.proceduralFootLock;
    const hipPosScale = footLock ? 0 : 1;
    const hipRotScale = footLock ? 0.2 : 1;
    const legScale = footLock ? 0 : 1;

    const hipSide = 0.02 * i * sway * weightShift * hipPosScale;
    const hipUp = 0.01 * i * breath * hipPosScale;
    applyBonePositionOffset("hips", hipSide, hipUp, 0.01 * i * sway2 * hipPosScale);

    applyBoneOffset(
      "hips",
      0.02 * i * sway2 * hipRotScale,
      0.08 * i * sway * hipRotScale,
      0.02 * i * sway2 * hipRotScale
    );

    applyBoneOffset("spine", 0.03 * i * sway2 * weightShift, -0.05 * i * sway, 0.01 * i * sway);
    applyBoneOffset("chest", 0.04 * i * sway2 * weightShift, -0.06 * i * sway, 0.02 * i * sway);
    applyBoneOffset("upperChest", 0.03 * i * breath, -0.03 * i * sway, 0.01 * i * sway);
    applyBoneOffset("neck", 0.03 * i * sway * headTilt, 0.04 * i * sway2 * headTilt, 0.03 * i * breath);
    applyBoneOffset("head", 0.05 * i * sway2 * headTilt, 0.06 * i * sway * headTilt, 0.04 * i * breath);

    const lUpper = computeBoneQuat(
      "leftUpperArm",
      0.05 * i * sway + armForward,
      0.02 * i * sway2,
      0.08 * i * sway - armRelax - armDown
    );
    const lLower = computeBoneQuat(
      "leftLowerArm",
      0.03 * i * sway + elbowBend,
      0.01 * i * sway2,
      0.05 * i * sway - armRelax * 0.4 - armDown * 0.2
    );
    const lHand = computeBoneQuat(
      "leftHand",
      0.02 * i * sway2,
      0.01 * i * sway2,
      0.03 * i * sway - armRelax * 0.2
    );
    const rUpper = computeBoneQuat(
      "rightUpperArm",
      -0.05 * i * sway + armForward,
      -0.02 * i * sway2,
      -0.08 * i * sway + armRelax + armDown
    );
    const rLower = computeBoneQuat(
      "rightLowerArm",
      -0.03 * i * sway + elbowBend,
      -0.01 * i * sway2,
      -0.05 * i * sway + armRelax * 0.4 + armDown * 0.2
    );
    const rHand = computeBoneQuat(
      "rightHand",
      -0.02 * i * sway2,
      -0.01 * i * sway2,
      -0.03 * i * sway + armRelax * 0.2
    );

    if (state.springEnabled) {
      setSpringTarget("leftUpperArm", lUpper);
      setSpringTarget("leftLowerArm", lLower);
      setSpringTarget("leftHand", lHand);
      setSpringTarget("rightUpperArm", rUpper);
      setSpringTarget("rightLowerArm", rLower);
      setSpringTarget("rightHand", rHand);
    } else {
      if (lUpper) getBoneNode("leftUpperArm")?.quaternion.copy(lUpper);
      if (lLower) getBoneNode("leftLowerArm")?.quaternion.copy(lLower);
      if (lHand) getBoneNode("leftHand")?.quaternion.copy(lHand);
      if (rUpper) getBoneNode("rightUpperArm")?.quaternion.copy(rUpper);
      if (rLower) getBoneNode("rightLowerArm")?.quaternion.copy(rLower);
      if (rHand) getBoneNode("rightHand")?.quaternion.copy(rHand);
    }

    applyBoneOffset("leftUpperLeg", -0.04 * i * sway * weightShift * legScale, 0, 0);
    applyBoneOffset("rightUpperLeg", 0.04 * i * sway * weightShift * legScale, 0, 0);
    applyBoneOffset("leftLowerLeg", 0.02 * i * sway2 * legScale, 0, 0);
    applyBoneOffset("rightLowerLeg", -0.02 * i * sway2 * legScale, 0, 0);
    applyBoneOffset("leftFoot", 0.015 * i * sway2 * legScale, 0, 0);
    applyBoneOffset("rightFoot", -0.015 * i * sway2 * legScale, 0, 0);

    updateSprings(dt);
  }

  return {
    setContext,
    syncBasePose,
    update,
  };
}
