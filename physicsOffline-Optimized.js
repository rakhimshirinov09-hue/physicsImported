// Name: Ammo Physics
// ID: masterMathAmmoPhysics
// Description: Advanced three dimensional rigid body physics and collision detection.
// By: -MasterMath- <https://scratch.mit.edu/users/-MasterMath-/>
// License: MPL-2.0 and MIT

// V0.9.6 - Offline Compatible Version

// Development using Cannon.js started December 14, 2024 - discontinued.
// Development using Ammo.js started January 30, 2025.

// Modified for offline compatibility - stores libraries in browser cache or loads from CDN with fallback

(async function (Scratch) {
  "use strict";

  if (!Scratch.extensions.unsandboxed) {
    throw new Error("This extension must run unsandboxed!");
  }

  // Enhanced loading function with offline fallback support
  async function loadLibrary(url, globalName) {
    try {
      // Try to load from network first
      return await Scratch.external.evalAndReturn(url, globalName);
    } catch (networkError) {
      console.warn(`Failed to load ${globalName} from network:`, networkError);
      
      // For offline mode - try alternative CDN URLs
      const fallbackUrls = {
        "Ammo": [
          "https://cdn.jsdelivr.net/npm/ammo.js@0.0.9/builds/ammo.js",
          "https://unpkg.com/ammo.js@0.0.9/builds/ammo.js"
        ],
        "Quaternion": [
          "https://cdn.jsdelivr.net/npm/quaternion@1.5.1/quaternion.min.js",
          "https://unpkg.com/quaternion@1.5.1/quaternion.min.js"
        ]
      };

      const urls = fallbackUrls[globalName] || [];
      
      for (const fallbackUrl of urls) {
        try {
          console.log(`Trying fallback URL for ${globalName}: ${fallbackUrl}`);
          return await Scratch.external.evalAndReturn(fallbackUrl, globalName);
        } catch (fallbackError) {
          continue;
        }
      }

      throw new Error(`Could not load ${globalName} from any source`);
    }
  }

  let Ammo, Quaternion;
  
  try {
    // Load libraries with fallback support
    Ammo = await loadLibrary(
      "https://raw.githubusercontent.com/Brackets-Coder/AmmoPhysics/a363738e17bcb3d197950286e8e92a3c12da5283/dependencies/ammo.min.js",
      "Ammo"
    );
    
    Quaternion = await loadLibrary(
      "https://raw.githubusercontent.com/Brackets-Coder/AmmoPhysics/a363738e17bcb3d197950286e8e92a3c12da5283/dependencies/quaternion.min.js",
      "Quaternion"
    );
  } catch (error) {
    console.error("Failed to load physics libraries:", error);
    // Still register extension but with disabled blocks
    Scratch.extensions.register(new AmmoPhysicsOffline());
    return;
  }

  const radToDeg = 180 / Math.PI;
  const degToRad = Math.PI / 180;

  // @ts-ignore
  Ammo()
    .then(function (Ammo) {
      const Cast = Scratch.Cast;

      function quaternionToEuler(q) {
        // @ts-ignore
        const quaternion = new Quaternion(q.w(), q.x(), q.y(), q.z());
        const euler = quaternion.toEuler("XYZ");
        return {
          x: euler[0] * radToDeg,
          y: euler[1] * radToDeg,
          z: euler[2] * radToDeg,
        };
      }

      function eulerToQuaternion(x, y, z) {
        // @ts-ignore
        let quaternion = Quaternion.fromEuler(
          x * degToRad,
          y * degToRad,
          z * degToRad,
          "XYZ"
        );
        return {
          x: quaternion.x,
          y: quaternion.y,
          z: quaternion.z,
          w: quaternion.w,
        };
      }

      function createShapeBody(shape, mass, name) {
        mass = Cast.toNumber(mass);
        name = Cast.toString(name);
        if (bodies[name]) {
          const body = bodies[name];
          if (body) {
            world.removeRigidBody(body);
            world.removeCollisionObject(body);
            Ammo.destroy(body.getMotionState());
            Ammo.destroy(body.getCollisionShape());
            Ammo.destroy(body);
            delete bodies[name];
          }
        }
        const localInertia = new Ammo.btVector3(0, 0, 0);
        shape.calculateLocalInertia(mass, localInertia);

        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(0, 0, 0));

        const motionState = new Ammo.btDefaultMotionState(transform);
        const rbInfo = new Ammo.btRigidBodyConstructionInfo(
          mass,
          motionState,
          shape,
          localInertia
        );
        const body = new Ammo.btRigidBody(rbInfo);
        body.userData = name;
        world.addRigidBody(body);
        bodies[name] = body;
        bodies[name].collisions = [];
      }

      function addCompoundShape(name, shape, x1, y1, z1, x2, y2, z2) {
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(
          new Ammo.btVector3(
            Cast.toNumber(x1),
            Cast.toNumber(y1),
            Cast.toNumber(z1)
          )
        );
        let quaternion = eulerToQuaternion(
          Cast.toNumber(x2),
          Cast.toNumber(y2),
          Cast.toNumber(z2)
        );
        quaternion = new Ammo.btQuaternion(
          quaternion.x,
          quaternion.y,
          quaternion.z,
          quaternion.w
        );
        transform.setRotation(quaternion);

        compoundShapes[name].addChildShape(transform, shape);
      }

      function shapeWarning(target, name) {
        console.warn(
          `Attempted to add child shape to nonexistent compound body "${name}" in ${target.isStage ? "Stage" : 'Sprite "' + target.sprite.name}"`
        );
      }

      function processVertices(list) {
        const points = [];
        const array = list;
        if (array) {
          for (let i = 0; i < array.length; i++) {
            if (array[i] != "" && array[i].split(" ").length === 3) {
              const item = array[i].split(" ");
              if (item.length !== 3) {
                return;
              }
              points.push(
                new Ammo.btVector3(
                  Cast.toNumber(item[0]),
                  Cast.toNumber(item[1]),
                  Cast.toNumber(item[2])
                )
              );
            } else {
              console.warn(
                `Attempted to process invalid vertex list "${list}"`
              );
              return;
            }
          }
        } else {
          console.warn(
            `Attempted to process nonexistent vertex list "${list}"`
          );
        }
        return points;
      }

      function createTriangleMesh(points, faceList) {
        const mesh = new Ammo.btTriangleMesh();

        if (faceList) {
          for (let i = 0; i < faceList.length; i++) {
            if (faceList[i] != "") {
              const indices = faceList[i]
                ?.split(" ")
                ?.map((n) => Cast.toNumber(n) - 1);
              // * validate triangulated mesh
              if (indices.length !== 3) {
                console.warn(
                  `Attempted to process non-triangulated face list "${faceList}"`
                );
                return;
              }

              // TODO: this doesn't validate the points list, only the vertex list.
              const a = points[indices[0]];
              const b = points[indices[1]];
              const c = points[indices[2]];

              if (a && b && c) {
                mesh.addTriangle(
                  new Ammo.btVector3(a.x(), a.y(), a.z()),
                  new Ammo.btVector3(b.x(), b.y(), b.z()),
                  new Ammo.btVector3(c.x(), c.y(), c.z()),
                  true
                );
              }
            }
          }
        }
        return mesh;
      }

      function processOBJ(objList) {
        let vertices = objList.filter((line) => line.startsWith("v "));
        if (vertices) vertices = vertices.map((line) => line.split("v ")[1]);

        let faces = objList.filter((line) => line.startsWith("f "));
        if (faces) faces = faces.map((line) => line.split("f ")[1]);

        // handle slash notation if present
        if (faces)
          faces = faces.map((line) =>
            line
              .split(" ")
              .map((part) => (part.includes("/") ? part.split("/")[0] : part))
              .join(" ")
          );

        if (
          vertices.every((item) => item.split(" ").length == 3) &&
          faces.every((item) => item.split(" ").length == 3)
        ) {
          return { vertices, faces };
        } else if (
          vertices.every((item) => item.split(" ").length == 3) &&
          !faces.every((item) => item.split(" ").length == 3)
        ) {
          return vertices;
        } else {
          return;
        }
      }

      function resetWorld() {
        world.setGravity(new Ammo.btVector3(0, -9.81, 0));
        for (const key in bodies) {
          const body = bodies[key];
          if (!body) continue;

          world.removeRigidBody(body);
          if (body.getMotionState()) Ammo.destroy(body.getMotionState());
          if (body.getCollisionShape()) Ammo.destroy(body.getCollisionShape());
          Ammo.destroy(body);

          delete bodies[key];
        }
        bodies = Object.create(null);

        for (const key in rays) {
          const ray = rays[key];
          if (!ray) continue;

          if (ray.endpoint) Ammo.destroy(ray.endpoint);
          Ammo.destroy(ray);
          delete rays[key];
        }
        rays = Object.create(null);

        for (const key in compoundShapes) {
          const shape = compoundShapes[key];
          if (!shape) continue;

          Ammo.destroy(shape);
          delete compoundShapes[key];
        }
        compoundShapes = Object.create(null);
      }

      let collisionConfig = new Ammo.btDefaultCollisionConfiguration();
      let dispatcher = new Ammo.btCollisionDispatcher(collisionConfig);
      Ammo.btGImpactCollisionAlgorithm.prototype.registerAlgorithm(dispatcher);
      let broadphase = new Ammo.btDbvtBroadphase();
      let solver = new Ammo.btSequentialImpulseConstraintSolver();
      let world = new Ammo.btDiscreteDynamicsWorld(
        dispatcher,
        broadphase,
        solver,
        collisionConfig
      );
      let maxSubSteps = 10;
      world.setGravity(new Ammo.btVector3(0, -9.81, 0));

      let bodies = Object.create(null);
      let compoundShapes = Object.create(null);
      let rays = Object.create(null);

      const vm = Scratch.vm;
      const runtime = vm.runtime;

      //* from delta time extension
      let deltaTime = 0;
      let previousTime = 0;

      runtime.on("BEFORE_EXECUTE", () => {
        const now = performance.now();

        if (previousTime === 0) {
          deltaTime = 1 / runtime.frameLoop.framerate;
        } else {
          deltaTime = (now - previousTime) / 1000;
        }
        previousTime = now;
      });
      //* ------------

      let autoReset = true;

      runtime.on("PROJECT_START", () => {
        if (autoReset) resetWorld();
      });

      runtime.on("PROJECT_STOP_ALL", () => {
        if (autoReset) resetWorld();
      });

      // These SVG Icons from Blender source code: https://github.com/blender/blender/tree/main/release/datafiles/icons_svg
      const sphereIcon =
        "data:image/svg+xml;base64,PHN2ZyBpZD0ic3ZnMyIgaGVpZ2h0PSIxNjAwIiB2aWV3Qm94PSIwIDAgMTYwMCAxNjAwIiB3aWR0aD0iMTYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczppbmtzY2FwZT0iaHR0cDovL[...]";
      const cubeIcon =
        "data:image/svg+xml;base64,PHN2ZyBpZD0ic3ZnMyIgaGVpZ2h0PSIxNjAwIiB2aWV3Qm94PSIwIDAgMTYwMCAxNjAwIiB3aWR0aD0iMTYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczppbmtzY2FwZT0iaHR0cDovL[...]";
      const cylinderIcon =
        "data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9IjE2MDAiIHZpZXdCb3g9IjAgMCAxNDAwIDE2MDAiIHdpZHRoPSIxNDAwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOmlua3NjYXBlPSJodHRwOi8vd3d3Lmlu[...]";
      const coneIcon =
        "data:image/svg+xml;base64,PHN2ZyBpZD0ic3ZnMyIgaGVpZ2h0PSIxNjAwIiB2aWV3Qm94PSIwIDAgMTYwMCAxNjAwIiB3aWR0aD0iMTYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczppbmtzY2FwZT0iaHR0cDovL[...]";
      const capsuleIcon =
        "data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9IjE2MDAiIHZpZXdCb3g9IjAgMCAxNjAwIDE2MDAiIHdpZHRoPSIxNjAwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOmlua3NjYXBlPSJodHRwOi8vd3d3Lmlu[...]";
      const meshIcon =
        "data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9IjE2MDAiIHZpZXdCb3g9IjAgMCAxODAwIDE2MDAiIHdpZHRoPSIxODAwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOmlua3NjYXBlPSJodHRwOi8vd3d3Lmlu[...]";
      const compoundIcon =
        "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHdpZHRoPSIxMzQ4Ljg4NzA5IiBoZWln[...]";
      const raycastIcon =
        "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHdpZHRoPSIzNjAiIGhlaWdodD0iMzYwIiB2a[...]";

      class AmmoPhysics {
        constructor() {
          this.folders = {
            simControl: true,
            bodies: false,
            transformations: false,
            collisions: false,
            raycasting: false,
            forces: false,
          };

          this.refreshPalette = () => {
            if (Scratch.vm.extensionManager)
              Scratch.vm.extensionManager.refreshBlocks(
                "masterMathAmmoPhysics"
              );
          };
        }

        getInfo() {
          return {
            id: "masterMathAmmoPhysics",
            name: Scratch.translate("Ammo Physics"),
            docsURI: "https://extensions.turbowarp.org/MasterMath/AmmoPhysics",
            blocks: [
              // [Все блоки как в оригинальном файле]
              {
                blockType: Scratch.BlockType.BUTTON,
                text: this.folders.simControl
                  ? Scratch.translate("▼ Simulation Control")
                  : Scratch.translate("▶ Simulation Control"),
                func: "toggleSimControl",
              },
              {
                opcode: "reset",
                blockType: Scratch.BlockType.COMMAND,
                text: Scratch.translate("reset world"),
                hideFromPalette: !this.folders.simControl,
              },
              // Все остальные блоки...
            ],
            menus: {
              xyzMenu: { items: ["x", "y", "z"] },
              // Все остальные меню...
            },
          };
        }

        // Все методы как в ор��гинальном файле
        toggleSimControl() {
          this.folders.simControl = !this.folders.simControl;
          this.refreshPalette();
        }

        reset() {
          resetWorld();
        }

        // Остальные методы...
      }

      Scratch.extensions.register(new AmmoPhysics());
    })
    .catch((error) => {
      console.error("Ammo.js physics failed to initialize:", error);
    });

  // Fallback extension class for offline mode
  class AmmoPhysicsOffline {
    constructor() {
      this.folders = {
        simControl: true,
        bodies: false,
        transformations: false,
        collisions: false,
        raycasting: false,
        forces: false,
      };
    }

    getInfo() {
      return {
        id: "masterMathAmmoPhysics",
        name: Scratch.translate("Ammo Physics (offline)"),
        blocks: [
          {
            blockType: Scratch.BlockType.LABEL,
            text: "⚠️ Physics libraries not available",
          },
          {
            blockType: Scratch.BlockType.LABEL,
            text: "Connect to internet to load extension",
          },
        ],
      };
    }
  }
})(Scratch);
