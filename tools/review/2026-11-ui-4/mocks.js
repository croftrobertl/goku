// Mockups for review batch 2026-11-ui-4, drawn inside the running app so they use its real styles.
const head = (t, close = 'Close') => `<div class="row"><h1 style="text-align:left">${t}</h1><button class="cta2">${close}</button></div>`;
const big = n => `<button class="cta2" style="width:100%;min-height:64px;font-size:1.15rem;margin-top:10px">${n}</button>`;
window.MOCKS = {
  'meal-a': head('Add food') + `<p class="lbl" style="margin-top:16px">Which meal is this?</p>
    ${big('Breakfast')}${big('Lunch')}${big('Dinner')}${big('Snacks')}
    <p class="note" style="margin-top:14px">Next you pick the food. You can still change the meal before adding.</p>`,
  'meal-b': head('Add food') + `<div class="seg meals" role="group"><button aria-pressed="false">Breakfast</button><button aria-pressed="false">Lunch</button><button aria-pressed="false">Dinner</button><button aria-pressed="false">Snacks</button></div>
    <p class="say" style="text-align:center">Pick a meal first, then search.</p>
    <input placeholder="Search foods, e.g. banana" disabled style="margin-top:16px;opacity:.5">
    <div class="seg" style="margin-top:8px;opacity:.5"><button>Recent</button><button>My foods</button><button>Meals</button></div>`,
};
