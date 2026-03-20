/**
 * Standalone Spine test — PixiJS + pixi-spine (same as FM preview).
 * Open /spine-test.html to see the character.
 */
import * as PIXI from 'pixi.js';
import { Spine, TextureAtlas } from 'pixi-spine';
import {
  AtlasAttachmentLoader,
  SkeletonJson,
  Skin,
} from '@pixi-spine/runtime-3.8';

const log = document.getElementById('log')!;
log.textContent = 'Loading...';

async function main() {
  const app = new PIXI.Application({
    width: 512,
    height: 512,
    backgroundColor: 0x1a1a2e,
    view: document.getElementById('spine-canvas') as HTMLCanvasElement,
  });

  // Load atlas text + json + textures
  const [atlasText, jsonData] = await Promise.all([
    fetch('/assets/spine/Base.atlas').then(r => r.text()),
    fetch('/assets/spine/Base.json').then(r => r.json()),
  ]);

  // Load texture images
  const tex1 = await PIXI.Assets.load('/assets/spine/Base.png');
  const tex2 = await PIXI.Assets.load('/assets/spine/Base2.png');

  // Create atlas with texture loader
  const atlas = new TextureAtlas(atlasText, (path: string, cb: any) => {
    if (path === 'Base.png') cb(tex1.baseTexture);
    else if (path === 'Base2.png') cb(tex2.baseTexture);
    else console.warn('Unknown texture:', path);
  });

  // Parse skeleton
  const attachmentLoader = new AtlasAttachmentLoader(atlas);
  const skelJson = new SkeletonJson(attachmentLoader);
  const skelData = skelJson.readSkeletonData(jsonData);

  log.textContent = `Loaded: ${skelData.animations.length} anims, ${skelData.skins.length} skins`;

  // Create Spine display object
  const spine = new Spine(skelData);

  // Combine skins
  const combinedSkin = new Skin('test');
  if (skelData.defaultSkin) combinedSkin.addSkin(skelData.defaultSkin);

  const skinNames = [
    'Body/Vampires/1/1',
    'Face_Ear/Vampires/1/1', 'Face_Eyes/Vampires/1/1',
    'Face_Eyes_Brows/Vampires/1/1', 'Face_Eyes_Pupils/Vampires/1/1',
    'Face_Nose/Vampires/1/1', 'Head/Vampires/1/1',
    'Wear_Body/legendary/necromancer/1/cyan',
    'Wear_Feet/legendary/necromancer/1/cyan',
    'Wear_Hair/legendary/necromancer/1/cyan',
    'Wear_Head/legendary/necromancer/1/cyan',
    'Wear_Legs/legendary/necromancer/1/cyan',
  ];

  let applied = 0;
  for (const name of skinNames) {
    const s = skelData.findSkin(name);
    if (s) { combinedSkin.addSkin(s); applied++; }
    else console.warn('Missing skin:', name);
  }

  (spine.skeleton as any).setSkin(combinedSkin);
  spine.skeleton.setSlotsToSetupPose();

  log.textContent += ` | Skins: ${applied}/${skinNames.length}`;

  // Play idle
  spine.state.setAnimation(0, 'Weapon_Melee_OneHanded/PerkMeleeBleedingKatana_1/Idle', true);

  // Position
  spine.x = 256;
  spine.y = 400;
  spine.scale.set(0.5);

  app.stage.addChild(spine);

  log.textContent += ' | RENDERING';
}

main().catch(e => {
  log.textContent = 'ERROR: ' + e.message;
  console.error(e);
});
