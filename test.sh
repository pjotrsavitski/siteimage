test_results_dir="test_results";
if [ ! -d "$test_results_dir" ]
then
	mkdir "$test_results_dir"
fi
curl --data "pageUrl=http://www.tlu.ee&responseFormat=binary" http://localhost:3000/capture > "$test_results_dir/tlu_ee_default.png"
curl --data "pageUrl=http://www.tlu.ee&imageFormat=jpeg&responseFormat=binary&viewportHeight=320&viewportWidth=240" http://localhost:3000/capture > "$test_results_dir/tlu_ee_small.jpeg"
curl --data "pageUrl=https://www.eesti.ee&responseFormat=binary" http://localhost:3000/capture > "$test_results_dir/eesti_ee_default.png"
curl --data "pageUrl=http://edidaktikum.ee&viewportWidth=320&viewportHeight=240&responseFormat=binary" http://localhost:3000/capture > "$test_results_dir/edidaktikum_small.png"
curl --data "pageUrl=http://getbootstrap.com/&viewportWidth=320&viewportHeight=568&responseFormat=binary" http://localhost:3000/capture > "$test_results_dir/bootstrap_phone.png"

