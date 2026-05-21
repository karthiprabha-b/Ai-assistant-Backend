async function checkDeals() {
  try {
    const res = await fetch('http://dealsndiscounts.com/Infowavesbot/index.html');
    const html = await res.text();
    console.log("HTML length:", html.length);
    console.log(html);
  } catch (err) {
    console.error("Error:", err);
  }
}

checkDeals();
