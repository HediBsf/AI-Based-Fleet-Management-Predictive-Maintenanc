# THis script converts YOLO models from .pt to .onnx format for browser compatibility

from ultralytics import YOLO
import os

os.makedirs('static/models', exist_ok=True)

# Convert Chaitanya model
print("\n1. Converting Chaitanya model...")
try:
    model = YOLO('models/chaitanya/best.pt')
    # Export with opset 11 for maximum browser compatibility
    model.export(format='onnx', opset=11, simplify=False)
    
    # Move to static/models
    src = 'models/chaitanya/best.onnx'
    dst = 'static/models/chaitanya_best.onnx'
    
    if os.path.exists(src):
        import shutil
        shutil.move(src, dst)
        print(f"✓ Chaitanya model converted and moved to {dst}")
        
        # Check file size
        size_mb = os.path.getsize(dst) / (1024 * 1024)
        print(f"  File size: {size_mb:.2f} MB")
    else:
        print("✗ Conversion failed - output file not found")
        
except Exception as e:
    print(f"✗ Error converting Chaitanya model: {e}")

# Convert Soham model
print("\n2. Converting Soham model...")
try:
    model = YOLO('models/soham/best.pt')
    # Export with opset 11 for maximum browser compatibility
    model.export(format='onnx', opset=11, simplify=False)
    
    # Move to static/models
    src = 'models/soham/best.onnx'
    dst = 'static/models/soham_best.onnx'
    
    if os.path.exists(src):
        import shutil
        shutil.move(src, dst)
        print(f"✓ Soham model converted and moved to {dst}")
        
        # Check file size
        size_mb = os.path.getsize(dst) / (1024 * 1024)
        print(f"  File size: {size_mb:.2f} MB")
    else:
        print("✗ Conversion failed - output file not found")
        
except Exception as e:
    print(f"✗ Error converting Soham model: {e}")

