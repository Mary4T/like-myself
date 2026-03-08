import React, { useRef, useState, useEffect } from 'react';
import {
  BsPencilFill,  // 替換 FaPen
  BsCursor,      // 套索工具圖標
  BsTypeH1,      // 替換 FaFont
  BsEraser,      // 替換 FaEraser
  BsImage,       // 替換 FaImage，注意這裡要加逗號
  BsArrowCounterclockwise,
  BsArrowClockwise
} from 'react-icons/bs';
import './DrawingCanvas.css';

const LAYER_TYPES = {
  IMAGE: 'image',
  DRAWING: 'drawing'
};

const DrawingCanvas = ({ value, onChange }) => {
  const canvasRef = useRef(null);
  const indicatorRef = useRef(null);
  const [tool, setTool] = useState('pen'); // pen, lasso, text, eraser
  const [drawing, setDrawing] = useState(false);
  const [textElements, setTextElements] = useState([]);
  const [penColor, setPenColor] = useState('#000000');
  const [strokeSize, setStrokeSize] = useState(2);
  const [canEraseImage, setCanEraseImage] = useState(false); // 添加新的狀態
  const [lastPos, setLastPos] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef(null);
  const [lassoPoints, setLassoPoints] = useState([]); // 存儲套索的點
  const [isLassoSelecting, setIsLassoSelecting] = useState(false); // 是否正在使用套索選擇
  const [selectedArea, setSelectedArea] = useState(null); // 存儲選中的區域
  const [isDragging, setIsDragging] = useState(false); // 是否正在拖動選中區域
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // 拖動的起始位置
  const [canSelectImage, setCanSelectImage] = useState(false); // 控制是否可以選擇圖片
  const [selectedAreaContent, setSelectedAreaContent] = useState(null);
  const [isMoving, setIsMoving] = useState(false);
  const [moveOffset, setMoveOffset] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [layers, setLayers] = useState([]);
  const [drawingLayer, setDrawingLayer] = useState(null);
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [imageLayer, setImageLayer] = useState([]);



  // 從 localStorage 讀取橡皮擦設置和圖片層
  useEffect(() => {
    // 讀取橡皮擦設置
    const savedCanEraseImage = localStorage.getItem('canEraseImage');
    if (savedCanEraseImage !== null) {
      setCanEraseImage(savedCanEraseImage === 'true');
    }
   
    // 讀取套索設置
    const savedCanSelectImage = localStorage.getItem('canSelectImage');
    if (savedCanSelectImage !== null) {
      setCanSelectImage(savedCanSelectImage === 'true');
    }
   
    // 讀取已保存的圖片層信息
    const savedImageLayer = localStorage.getItem('imageLayer');
    if (savedImageLayer) {
      const parsedImageLayer = JSON.parse(savedImageLayer);
      // 重新創建圖片元素
      const reconstructedLayer = parsedImageLayer.map(imgInfo => {
        const img = new Image();
        img.src = imgInfo.src;
        return {
          ...imgInfo,
          element: img
        };
      });
      setImageLayer(reconstructedLayer);
    }
  }, []);


  // 初始化 Canvas 和繪圖層
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
  
    const ctx = canvas.getContext('2d');
  
    // 設置 Canvas 大小
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  
    // 同步設置指示圈 canvas 大小
    if (indicatorRef.current) {
      indicatorRef.current.width = canvas.width;
      indicatorRef.current.height = canvas.height;
    }
  
    // 初始化繪圖層
    if (!drawingLayer) {
      const newDrawingLayer = initializeDrawingLayer();
      setDrawingLayer(newDrawingLayer);
    }
  
    // 載入已保存的內容（包括任務描述等）
    if (value) {
      const img = new Image();
      img.onload = () => {
        // 清除 Canvas 然後繪製圖片
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        // 如果繪圖層已初始化，也渲染圖層
        if (drawingLayer) {
          setTimeout(() => renderAllLayers(), 100);
        }
      };
      img.src = value;
    } else {
      // 沒有 value 時，確保渲染圖層
      if (drawingLayer) {
        setTimeout(() => renderAllLayers(), 100);
      }
    }
  }, [value, drawingLayer]); // 注意：依賴項添加了 drawingLayer

  // 監聽圖層變化，自動重新渲染
  useEffect(() => {
    if (drawingLayer) {
      renderAllLayers();
    }
  }, [layers, drawingLayer]); // 當圖層或繪圖層變化時重新渲染


  // 處理窗口大小變更時的 Canvas 調整
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
     
      // 保存當前內容
      const currentImageData = canvas.toDataURL();
     
      // 調整大小
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
     
      // 同步指示器大小
      if (indicatorRef.current) {
        indicatorRef.current.width = canvas.width;
        indicatorRef.current.height = canvas.height;
      }
     
      // 恢復內容
      if (currentImageData && currentImageData !== 'data:,') {
        const img = new Image();
        img.onload = () => {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = currentImageData;
      }
    };


    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  // 更新滑鼠位置和指示圈
  const updateMousePosition = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
  };


  // 渲染指示圈
  useEffect(() => {
    if (tool === 'eraser') {
      renderEraserIndicator();
    } else {
      // 清除指示圈
      const indicator = indicatorRef.current;
      if (indicator) {
        const ctx = indicator.getContext('2d');
        ctx.clearRect(0, 0, indicator.width, indicator.height);
      }
    }
  }, [mousePos, strokeSize, tool]);

  // 添加保存歷史記錄的函數
  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const newState = canvas.toDataURL();
    const newHistory = history.slice(0, currentStep + 1);
    newHistory.push(newState);
    
    setHistory(newHistory);
    setCurrentStep(newHistory.length - 1);
  };

  // 還原功能
  const handleUndo = () => {
    if (currentStep > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = history[currentStep - 1];
      setCurrentStep(currentStep - 1);
    }
  };

  // 重做功能
  const handleRedo = () => {
    if (currentStep < history.length - 1) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = history[currentStep + 1];
      setCurrentStep(currentStep + 1);
    }
  };

  // 改進的選區內容恢復函數
const restoreSelectedContent = () => {
  if (!selectedArea) return;

  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d');

  // 使用路徑裁剪精確恢復選區內容
  const img = new Image();
  img.onload = () => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(
      selectedArea.path[0].x + selectedArea.x, 
      selectedArea.path[0].y + selectedArea.y
    );
    selectedArea.path.forEach(p => {
      ctx.lineTo(p.x + selectedArea.x, p.y + selectedArea.y);
    });
    ctx.closePath();
    ctx.clip();
    
    ctx.drawImage(
      img,
      selectedArea.x,
      selectedArea.y,
      selectedArea.width,
      selectedArea.height
    );
    ctx.restore();
    saveCanvas();
  };
  img.src = selectedArea.imageData;
};


// 正確的選擇性橡皮擦邏輯
const handleErase = (x, y, prevX = null, prevY = null) => {
  const ctx = canvasRef.current.getContext('2d');
  
  if (canEraseImage) {
    // 允許擦除圖片：直接擦除一切
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    
    if (prevX !== null && prevY !== null) {
      ctx.lineWidth = strokeSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, strokeSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  } else {
    // 不允許擦除圖片：保護圖片的方法
    
    // 1. 首先保存橡皮擦區域內的圖片內容
    let imageContent = null;
    if (imageLayer.length > 0) {
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      // 計算橡皮擦影響的區域
      let eraseBounds;
      if (prevX !== null && prevY !== null) {
        const minX = Math.min(prevX, x) - strokeSize / 2;
        const maxX = Math.max(prevX, x) + strokeSize / 2;
        const minY = Math.min(prevY, y) - strokeSize / 2;
        const maxY = Math.max(prevY, y) + strokeSize / 2;
        eraseBounds = {
          x: Math.max(0, minX),
          y: Math.max(0, minY),
          width: Math.min(ctx.canvas.width, maxX) - Math.max(0, minX),
          height: Math.min(ctx.canvas.height, maxY) - Math.max(0, minY)
        };
      } else {
        eraseBounds = {
          x: Math.max(0, x - strokeSize / 2),
          y: Math.max(0, y - strokeSize / 2),
          width: Math.min(strokeSize, ctx.canvas.width - Math.max(0, x - strokeSize / 2)),
          height: Math.min(strokeSize, ctx.canvas.height - Math.max(0, y - strokeSize / 2))
        };
      }
      
      // 設置臨時畫布大小
      tempCanvas.width = eraseBounds.width;
      tempCanvas.height = eraseBounds.height;
      
      // 在臨時畫布上只繪製圖片
      imageLayer.forEach(img => {
        if (img && img.element && !img.erased && img.element.complete) {
          // 檢查圖片是否與橡皮擦區域重疊
          if (img.x < eraseBounds.x + eraseBounds.width && 
              img.x + img.width > eraseBounds.x &&
              img.y < eraseBounds.y + eraseBounds.height && 
              img.y + img.height > eraseBounds.y) {
            
            tempCtx.drawImage(
              img.element,
              img.x - eraseBounds.x,
              img.y - eraseBounds.y,
              img.width,
              img.height
            );
          }
        }
      });
      
      imageContent = { canvas: tempCanvas, bounds: eraseBounds };
    }
    
    // 2. 執行擦除操作
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    
    if (prevX !== null && prevY !== null) {
      ctx.lineWidth = strokeSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, strokeSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
    
    // 3. 恢復圖片內容（如果有的話）
    if (imageContent && imageContent.canvas.width > 0 && imageContent.canvas.height > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      
      // 應用橡皮擦形狀的遮罩
      ctx.beginPath();
      if (prevX !== null && prevY !== null) {
        ctx.lineWidth = strokeSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
      } else {
        ctx.arc(x, y, strokeSize / 2, 0, Math.PI * 2);
      }
      ctx.clip();
      
      // 恢復圖片
      ctx.drawImage(
        imageContent.canvas,
        imageContent.bounds.x,
        imageContent.bounds.y
      );
      
      ctx.restore();
    }
  }
};

// 改進的橡皮擦指示圈渲染
const renderEraserIndicator = () => {
  const indicator = indicatorRef.current;
  if (!indicator || tool !== 'eraser') return;

  const ctx = indicator.getContext('2d');
  ctx.clearRect(0, 0, indicator.width, indicator.height);

  if (mousePos.x >= 0 && mousePos.y >= 0) {
    // 繪製外圈
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, strokeSize / 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 繪製內圈（半透明填充）
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, strokeSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();
    
    // 繪製中心點
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
  }
};

  // 計算選取區域邊界的輔助函數
  const calculateBounds = (points) => {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
   
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  };


  // 添加檢查套索區域與圖片重疊的函數
  const checkIntersection = (lassoPoints, image) => {
    // 簡單的邊界框檢查
    const bounds = calculateBounds(lassoPoints);
    return !(bounds.x > image.x + image.width ||
             bounds.x + bounds.width < image.x ||
             bounds.y > image.y + image.height ||
             bounds.y + bounds.height < image.y);
  };


  // 處理套索開始
  const handleLassoStart = (e) => {
    if (tool !== 'lasso') return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 檢查是否點擊在圖片上
    if (canSelectImage) {
      const clickedImage = imageLayer.find(img => {
        return x >= img.x && x <= img.x + img.width &&
               y >= img.y && y <= img.y + img.height;
      });
  
      if (!clickedImage) {
        // 如果沒有點擊到圖片，不執行任何操作
        return;
      }
    }
  
    setIsLassoSelecting(true);
    setLassoPoints([{ x, y }]);
    setSelectedArea(null);
  };


  // 修改後的 handleDraw 函數（改進橡皮擦部分）
  const handleDraw = (e) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'pen') {
      ctx.strokeStyle = penColor;
      ctx.lineWidth = strokeSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (lastPos) {
        // 繪製從上一個位置到當前位置的線條
        ctx.beginPath();
        ctx.moveTo(lastPos.x, lastPos.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else {
        // 第一個點，畫一個小圓點
        ctx.beginPath();
        ctx.arc(x, y, strokeSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = penColor;
        ctx.fill();
      }
      
      // 更新上一個位置
      setLastPos({ x, y });
    } else if (tool === 'eraser') {
      // 使用改進的橡皮擦邏輯
      const prevX = lastPos ? lastPos.x : null;
      const prevY = lastPos ? lastPos.y : null;
      handleErase(x, y, prevX, prevY);
      setLastPos({ x, y });
    }
  };


  // 處理套索繪製（修正版）
  const handleLassoDraw = (e) => {
    if (!isLassoSelecting || tool !== 'lasso') return;
     
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
     
    // 繪製套索路徑
    const ctx = indicatorRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
     
    if (lassoPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
       
      // 繪製已有的點
      lassoPoints.forEach((point, index) => {
        if (index > 0) {
          ctx.lineTo(point.x, point.y);
        }
      });
       
      // 連接到當前滑鼠位置
      ctx.lineTo(x, y);
       
      // 設置虛線樣式
      ctx.strokeStyle = '#666';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
 
    // 只在滑鼠移動一定距離時才添加新點
    const lastPoint = lassoPoints[lassoPoints.length - 1];
    if (lastPoint) {
      const dx = x - lastPoint.x;
      const dy = y - lastPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 5) { // 只有當移動距離大於 5 像素時才添加新點
        setLassoPoints(prev => [...prev, { x, y }]);
      }
    }
  };

  // 檢查點是否在多邊形內部的函數（射線法）
  const isPointInPolygon = (point, polygon) => {
    const { x, y } = point;
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const { x: xi, y: yi } = polygon[i];
      const { x: xj, y: yj } = polygon[j];
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  };




  const handleSelectionDragStart = (e) => {
    if (!selectedArea) return;
   
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
   
    // 開始拖曳時清除原始區域
    ctx.clearRect(
      selectedArea.x,
      selectedArea.y,
      selectedArea.width,
      selectedArea.height
    );
   
    setIsDragging(true);
    setDragStart({ x, y });
    setDragOffset({ x: 0, y: 0 });
  };
  
  const handleSelectionDrag = (e) => {
    if (!isDragging || !selectedArea) return;
  
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
  
    const dx = x - dragStart.x;
    const dy = y - dragStart.y;
  
    // 計算新位置，添加邊界檢查
    const newX = selectedArea.x + dx;
    const newY = selectedArea.y + dy;
    
    // 確保選區不會移出畫布邊界
    const clampedX = Math.max(0, Math.min(canvas.width - selectedArea.width, newX));
    const clampedY = Math.max(0, Math.min(canvas.height - selectedArea.height, newY));
  
    setSelectedArea(prev => ({
      ...prev,
      x: clampedX,
      y: clampedY
    }));
  
    setDragStart({ x, y });
  };
  
  const handleSelectionDragEnd = () => {
    if (!isDragging || !selectedArea) return;
  
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
  
    // 在新位置繪製選區內容
    const img = new Image();
    img.onload = () => {
      // 使用路徑裁剪來精確繪製選區內容
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(
        selectedArea.path[0].x + selectedArea.x, 
        selectedArea.path[0].y + selectedArea.y
      );
      selectedArea.path.forEach(p => {
        ctx.lineTo(p.x + selectedArea.x, p.y + selectedArea.y);
      });
      ctx.closePath();
      ctx.clip();
      
      ctx.drawImage(
        img,
        selectedArea.x,
        selectedArea.y,
        selectedArea.width,
        selectedArea.height
      );
      ctx.restore();
      
      saveCanvas();
      setSelectedArea(null); // 完成移動後清除選區
    };
    img.src = selectedArea.imageData;
  
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  };
 
  // 改進的套索結束處理函數
  const handleLassoEnd = () => {
    if (!isLassoSelecting || tool !== 'lasso') return;

    if (lassoPoints.length < 3) {
      setIsLassoSelecting(false);
      setLassoPoints([]);
      const indicatorCtx = indicatorRef.current.getContext('2d');
      indicatorCtx.clearRect(0, 0, indicatorRef.current.width, indicatorRef.current.height);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    try {
      const bounds = calculateBounds(lassoPoints);
      
      // 創建一個臨時畫布來提取選區內容
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = bounds.width;
      tempCanvas.height = bounds.height;
      
      // 將原始畫布內容繪製到臨時畫布
      tempCtx.drawImage(
        canvas, 
        bounds.x, bounds.y, bounds.width, bounds.height,
        0, 0, bounds.width, bounds.height
      );
      
      // 應用套索路徑裁剪到臨時畫布
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.beginPath();
      tempCtx.moveTo(lassoPoints[0].x - bounds.x, lassoPoints[0].y - bounds.y);
      lassoPoints.forEach(p => {
        tempCtx.lineTo(p.x - bounds.x, p.y - bounds.y);
      });
      tempCtx.closePath();
      tempCtx.fill();
      
      // 清除原始畫布上的選區內容
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
      lassoPoints.forEach(p => {
        ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      setSelectedArea({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        imageData: tempCanvas.toDataURL(),
        path: lassoPoints.map(p => ({
          x: p.x - bounds.x,
          y: p.y - bounds.y
        })),
        originalPath: [...lassoPoints] // 保存原始路徑
      });

      setIsLassoSelecting(false);
      setLassoPoints([]);
      
      const indicatorCtx = indicatorRef.current.getContext('2d');
      indicatorCtx.clearRect(0, 0, canvas.width, canvas.height);

    } catch (error) {
      console.error('Error in handleLassoEnd:', error);
      setSelectedArea(null);
    }
  };
 
  // 處理選取區域的刪除
  const handleDeleteSelection = () => {
    if (!selectedArea) return;
   
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
   
    // 清除選中區域
    ctx.clearRect(
      selectedArea.x,
      selectedArea.y,
      selectedArea.width,
      selectedArea.height
    );
   
    setSelectedArea(null);
    saveCanvas();
  };
 


  // 處理選取區域的複製
  const handleCopySelection = () => {
    if (!selectedArea) return;
    setSelectedAreaContent(selectedArea.imageData);
  };


  // 處理選取區域的剪下
  const handleCutSelection = () => {
    if (!selectedArea) return;
    handleCopySelection();
    handleDeleteSelection();
  };


  // 文字工具
  const handleTextAdd = (e) => {
    if (tool !== 'text') return;


    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;


    const textElement = {
      id: Date.now(),
      x,
      y,
      text: '',
      editing: true
    };


    setTextElements([...textElements, textElement]);
  };


  // 修改圖片上傳處理（保存 base64 數據到 localStorage）
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');


          // 計算圖片大小
          const maxWidth = canvas.width * 0.8;
          const maxHeight = canvas.height * 0.8;
          let width = img.width;
          let height = img.height;


          if (width > maxWidth) {
            height = (maxWidth * height) / width;
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = (maxHeight * width) / height;
            height = maxHeight;
          }
          // 計算居中位置
          const x = (canvas.width - width) / 2;
          const y = (canvas.height - height) / 2;
          // 繪製圖片
          ctx.drawImage(img, x, y, width, height);


          // 保存圖片層信息，包含圖片的 base64 數據
          const newImageLayer = [...imageLayer, {
            element: img,
            src: event.target.result, // 保存 base64 數據
            x,
            y,
            width,
            height
          }];


          setImageLayer(newImageLayer);
          localStorage.setItem('imageLayer', JSON.stringify(
            newImageLayer.map(({ element, ...rest }) => rest)
          ));
          saveCanvas();
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };


  // 修改 canEraseImage 的設置處理函數
  const handleCanEraseImageChange = (e) => {
    const newValue = e.target.checked;
    setCanEraseImage(newValue);
    localStorage.setItem('canEraseImage', newValue);
  };


  // 修改 renderLassoOptions 函數
  const renderLassoOptions = () => {
    if (tool === 'lasso') {
      return (
        <div className="lasso-options">
          <label className="lasso-checkbox">
            <input
              type="checkbox"
              checked={canSelectImage}
              onChange={(e) => {
                const newValue = e.target.checked;
                setCanSelectImage(newValue);
                localStorage.setItem('canSelectImage', newValue);
              }}
            />
            可選擇圖片
          </label>
        </div>
      );
    }
    return null;
  };


  // 修改工具欄，添加橡皮擦選項
  const renderToolOptions = () => {
    if (tool === 'pen' || tool === 'eraser') {
      return (
        <div className="tool-options">
          <input
            type="range"
            min={tool === 'pen' ? "1" : "5"}
            max={tool === 'pen' ? "20" : "50"}
            value={strokeSize}
            onChange={(e) => setStrokeSize(Number(e.target.value))}
            title={tool === 'pen' ? "筆刷大小" : "橡皮擦大小"}
          />
          {tool === 'eraser' && (
            <label className="eraser-checkbox">
              <input
                type="checkbox"
                checked={canEraseImage}
                onChange={handleCanEraseImageChange}
              />
              可擦除圖片
            </label>
          )}
        </div>
      );
    }
    return null;
  };


  // 保存 Canvas 內容
  const saveCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL();
      onChange?.(dataUrl);
      saveToHistory(); // 添加這行
      console.log('Canvas 已保存');
    } catch (error) {
      console.error('保存 Canvas 時發生錯誤:', error);
    }
  };

  // 創建圖片圖層
  const createImageLayer = (imageElement, src, x, y, width, height) => ({
    id: Date.now() + Math.random(),
    type: LAYER_TYPES.IMAGE,
    name: `圖片 ${Date.now()}`,
    element: imageElement,
    src: src,
    x: x,
    y: y,
    width: width,
    height: height,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: layers.length
  });

  // 初始化繪圖層
  const initializeDrawingLayer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const drawingCanvas = document.createElement('canvas');
    drawingCanvas.width = canvas.width;
    drawingCanvas.height = canvas.height;
    
    return {
      id: 'drawing-layer',
      type: LAYER_TYPES.DRAWING,
      name: '繪圖層',
      canvas: drawingCanvas,
      ctx: drawingCanvas.getContext('2d'),
      visible: true,
      opacity: 1
    };
  };

  // 渲染所有圖層到主畫布
  const renderAllLayers = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // 清空主畫布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 按照 zIndex 排序圖層
    const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);
    
    // 渲染每個圖層
    sortedLayers.forEach(layer => {
      if (!layer.visible) return;
      
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      
      if (layer.type === LAYER_TYPES.IMAGE) {
        // 渲染圖片層
        if (layer.element && layer.element.complete) {
          ctx.save();
          
          // 應用變形
          const centerX = layer.x + layer.width / 2;
          const centerY = layer.y + layer.height / 2;
          
          ctx.translate(centerX, centerY);
          ctx.rotate(layer.rotation * Math.PI / 180);
          ctx.scale(layer.scaleX, layer.scaleY);
          ctx.translate(-layer.width / 2, -layer.height / 2);
          
          ctx.drawImage(layer.element, 0, 0, layer.width, layer.height);
          
          ctx.restore();
        }
      }
      
      ctx.restore();
    });
    
    // 最後渲染繪圖層（如果存在）
    if (drawingLayer && drawingLayer.canvas && drawingLayer.visible) {
      ctx.save();
      ctx.globalAlpha = drawingLayer.opacity;
      ctx.drawImage(drawingLayer.canvas, 0, 0);
      ctx.restore();
    }
  };

  // 添加圖片圖層
  const addImageLayer = (imageElement, src, x, y, width, height) => {
    const newLayer = createImageLayer(imageElement, src, x, y, width, height);
    setLayers(prev => [...prev, newLayer]);
    
    // 保存到 localStorage（暫時簡化）
    try {
      const layersToSave = [...layers, newLayer].map(layer => ({
        ...layer,
        element: undefined, // 不保存 DOM 元素
        canvas: undefined,
        ctx: undefined
      }));
      
      localStorage.setItem('layers', JSON.stringify(layersToSave));
    } catch (error) {
      console.error('保存圖層失敗:', error);
    }
    
    return newLayer.id;
  };

  // 更新圖層屬性
  const updateLayer = (layerId, updates) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId ? { ...layer, ...updates } : layer
    ));
    
    // 重新渲染
    setTimeout(() => renderAllLayers(), 0);
  };

  // 移動圖層順序
  const moveLayer = (layerId, direction) => {
    setLayers(prev => {
      const layerIndex = prev.findIndex(l => l.id === layerId);
      if (layerIndex === -1) return prev;
      
      const newLayers = [...prev];
      const targetIndex = direction === 'up' ? layerIndex + 1 : layerIndex - 1;
      
      if (targetIndex >= 0 && targetIndex < newLayers.length) {
        // 交換 zIndex
        [newLayers[layerIndex].zIndex, newLayers[targetIndex].zIndex] = 
        [newLayers[targetIndex].zIndex, newLayers[layerIndex].zIndex];
      }
      
      return newLayers;
    });
    
    // 重新渲染
    setTimeout(() => renderAllLayers(), 0);
  };

  // 刪除圖層
  const deleteLayer = (layerId) => {
    setLayers(prev => prev.filter(layer => layer.id !== layerId));
    if (selectedLayer?.id === layerId) {
      setSelectedLayer(null);
    }
    
    // 重新渲染
    setTimeout(() => renderAllLayers(), 0);
  };


  return (
    <div className="drawing-canvas-container">
      <div className="toolbar">
        <button
          className={`tool-btn ${tool === 'pen' ? 'active' : ''}`}
          onClick={() => setTool('pen')}
          title="畫筆"
        >
          <BsPencilFill />
        </button>

        <button
          className="tool-btn"
          onClick={handleUndo}
          disabled={currentStep <= 0}
          title="還原"
        >
          <BsArrowCounterclockwise />
        </button>
        <button
          className="tool-btn"
          onClick={handleRedo}
          disabled={currentStep >= history.length - 1}
          title="重做"
        >
          <BsArrowClockwise />
        </button>

        <button
          className={`tool-btn ${tool === 'lasso' ? 'active' : ''}`}
          onClick={() => setTool('lasso')}
          title="套索工具"
        >
          <BsCursor />
        </button>
        <button
          className={`tool-btn ${tool === 'text' ? 'active' : ''}`}
          onClick={() => setTool('text')}
          title="文字"
        >
          <BsTypeH1 />
        </button>
        <button
          className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
          onClick={() => setTool('eraser')}
          title="橡皮擦"
        >
          <BsEraser />
        </button>
        <button
          className="tool-btn"
          onClick={() => fileInputRef.current.click()}
          title="插入圖片"
        >
          <BsImage />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageUpload}
        />
        <input
          type="color"
          value={penColor}
          onChange={(e) => setPenColor(e.target.value)}
          title="顏色選擇"
        />
        {renderToolOptions()}

        {renderLassoOptions()}
      </div>


      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="drawing-canvas"
          onMouseDown={(e) => {
            // 如果點擊的不是選區，且當前有選區
            if (selectedArea && tool !== 'lasso') {
              restoreSelectedContent(); // 恢復選區內容
              setSelectedArea(null);    // 清除選區
              return;
            }
          
            if (tool === 'lasso') {
              handleLassoStart(e);
            } else {
              setDrawing(true);
              // 重要：初始化 lastPos 為 null，讓第一個點正確繪製
              setLastPos(null);
              
              // 立即處理第一個點
              const canvas = canvasRef.current;
              const ctx = canvas.getContext('2d');
              const rect = canvas.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              
              if (tool === 'pen') {
                ctx.strokeStyle = penColor;
                ctx.lineWidth = strokeSize;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                // 繪製起始點
                ctx.beginPath();
                ctx.arc(x, y, strokeSize / 2, 0, Math.PI * 2);
                ctx.fillStyle = penColor; // 確保填充顏色正確
                ctx.fill();
                
                setLastPos({ x, y });
              } else if (tool === 'eraser') {
                // 橡皮擦起始點
                handleErase(x, y);
                setLastPos({ x, y });
              }
            }
            updateMousePosition(e);
          }}
          onMouseMove={(e) => {
            if (tool === 'lasso' && isLassoSelecting) {
              handleLassoDraw(e);
            } else if (drawing) {
              handleDraw(e);
            }
            updateMousePosition(e);
          }}
          onMouseUp={(e) => {
            if (tool === 'lasso' && isLassoSelecting) {
              handleLassoEnd();
            } else {
              setDrawing(false);
              saveCanvas();
            }
          }}
          onMouseLeave={(e) => {
            if (isLassoSelecting) {
              setIsLassoSelecting(false);
              setLassoPoints([]);
            }
            setDrawing(false);
            saveCanvas();
          }}
          onClick={tool === 'text' ? handleTextAdd : undefined}
          style={{
            cursor: tool === 'eraser' ? 'none' :
                  tool === 'lasso' ? 'crosshair' : 'default'
          }}
        />


        {/* 指示圈圖層 */}
        <canvas
          ref={indicatorRef}
          className="indicator-canvas"
          style={{
            display: tool === 'eraser' || tool === 'lasso' ? 'block' : 'none',
            pointerEvents: 'none',  // 確保這個圖層不會干擾滑鼠事件
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 10
          }}
        />


        {/* 修改後的套索選區顯示 */}
        {selectedArea && (
          <>
            <div
              className="lasso-selection"
              style={{
                position: 'absolute',
                left: selectedArea.x,
                top: selectedArea.y,
                width: selectedArea.width,
                height: selectedArea.height,
                cursor: 'move',
                pointerEvents: 'auto'
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleSelectionDragStart(e);
              }}
              onMouseMove={(e) => {
                e.stopPropagation();
                if (isDragging) {
                  handleSelectionDrag(e);
                }
              }}
              onMouseUp={(e) => {
                e.stopPropagation();
                if (isDragging) {
                  handleSelectionDragEnd();
                }
              }}
              onMouseLeave={(e) => {
                e.stopPropagation();
                if (isDragging) {
                  handleSelectionDragEnd();
                }
              }}
            >
              {/* 使用 Canvas 來顯示選區內容 */}
              <canvas
                ref={(canvas) => {
                  if (canvas && selectedArea.imageData) {
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.onload = () => {
                      ctx.clearRect(0, 0, canvas.width, canvas.height);
                      ctx.save();
                     
                      // 設置剪裁路徑
                      ctx.beginPath();
                      ctx.moveTo(selectedArea.path[0].x, selectedArea.path[0].y);
                      selectedArea.path.forEach(p => {
                        ctx.lineTo(p.x, p.y);
                      });
                      ctx.closePath();
                      ctx.clip();
                     
                      // 繪製選區內容
                      ctx.drawImage(img, 0, 0);
                      ctx.restore();
                     
                      // 繪製邊框
                      ctx.beginPath();
                      ctx.moveTo(selectedArea.path[0].x, selectedArea.path[0].y);
                      selectedArea.path.forEach(p => {
                        ctx.lineTo(p.x, p.y);
                      });
                      ctx.closePath();
                      ctx.strokeStyle = '#666';
                      ctx.setLineDash([5, 5]);
                      ctx.stroke();
                    };
                    img.src = selectedArea.imageData;
                  }
                }}
                width={selectedArea.width}
                height={selectedArea.height}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0
                }}
              />
            </div>


          </>
        )}


          {/* 添加選取區域的控制按鈕 */}
          {selectedArea && (
            <div className="selection-controls" style={{
              position: 'absolute',
              top: selectedArea.y - 30,
              left: selectedArea.x
            }}>
              <button onClick={handleCopySelection} title="複製">
                複製
              </button>
              <button onClick={handleCutSelection} title="剪下">
                剪下
              </button>
              <button onClick={handleDeleteSelection} title="刪除">
                刪除
              </button>
            </div>
          )}


        {textElements.map(textElem => (
          <div
            key={textElem.id}
            style={{
              position: 'absolute',
              left: textElem.x,
              top: textElem.y,
              zIndex: 20
            }}
          >
            <input
              type="text"
              value={textElem.text}
              onChange={(e) => {
                const updatedElements = textElements.map(elem =>
                  elem.id === textElem.id
                    ? { ...elem, text: e.target.value }
                    : elem
                );
                setTextElements(updatedElements);
              }}
              onBlur={() => {
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                ctx.font = '16px Arial';
                ctx.fillStyle = penColor; // 使用當前選中的顏色
                ctx.fillText(textElem.text, textElem.x, textElem.y);
                setTextElements(elements =>
                  elements.filter(elem => elem.id !== textElem.id)
                );
                saveCanvas(); // 確保保存
              }}
              autoFocus
            />
          </div>
        ))}
      </div>
    </div>
  );
};


export default DrawingCanvas;