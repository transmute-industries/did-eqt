
./opa build -t wasm -e policy/hello ./policies/test-1.rego

tar -xzf ./bundle.tar.gz /policy.wasm

mv ./policy.wasm ./policies/test-0.wasm

rm ./bundle.tar.gz

./opa eval --format pretty data.example.public_server -i ./policies/test-1-input.json -d ./policies/test-1.rego -s ./policies/test-1-json-schema.json