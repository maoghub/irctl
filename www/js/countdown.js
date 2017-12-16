window.onload = initAll

function initAll() {
	$('#countdown').countdown({until: "+30m", format: "MS",  compact:true });
}