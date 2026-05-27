export const runtime = 'edge'; // 声明使用边缘计算运行时，适配 EdgeOne Pages

const GROUP_NAME = '看球通';
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
  'Accept': 'application/json'
};

// 获取数据的核心方法
async function getValidStreams() {
  const pageResp = await fetch('https://aapi2.xbncs.com/api/room/page', { headers });
  const pageData = await pageResp.json();
  const list = pageData?.data?.list || [];

  if (list.length === 0) return [];

  const detailPromises = list.map(async (room) => {
    try {
      const detailResp = await fetch(`https://aapi2.xbncs.com/api/room/detail?roomId=${room.roomId}`, { headers });
      const detailData = await detailResp.json();
      if (detailData?.data) {
        return { ...room, ...detailData.data };
      }
      return null;
    } catch (error) {
      return null;
    }
  });

  const details = await Promise.all(detailPromises);
  return details.filter(d => d && (d.pullUrl || d.pushUrl));
}

// 清理频道名的公共方法
const formatChannelName = (stream) => {
  let rawTitle = (stream.title || stream.nickName || `Room_${stream.roomId}`).replace(/[\r\n]/g, '').trim();
  rawTitle = rawTitle.replace(/\s*vs\s*/gi, '_VS_');
  rawTitle = rawTitle.replace(/\s*-\s*/g, ':');
  if (stream.leagueName && !rawTitle.includes(stream.leagueName)) {
    rawTitle = `${stream.leagueName}:${rawTitle}`;
  }
  if (!rawTitle.includes(':') && !rawTitle.includes('：')) {
    const vsIndex = rawTitle.indexOf('_VS_');
    const firstSpaceIndex = rawTitle.indexOf(' ');
    if (vsIndex > -1 && firstSpaceIndex > -1 && firstSpaceIndex < vsIndex) {
      rawTitle = rawTitle.substring(0, firstSpaceIndex) + ':' + rawTitle.substring(firstSpaceIndex + 1);
    }
  }
  rawTitle = rawTitle.replace(/\s+/g, '');
  return rawTitle;
};

// 处理 GET 请求
export async function GET(request) {
  try {
    const validStreams = await getValidStreams();

    if (validStreams.length === 0) {
      return new Response('未获取到直播房间数据', { status: 404 });
    }

    let txtContent = `${GROUP_NAME},#genre#\n`;
    
    validStreams.forEach(stream => {
      const baseName = formatChannelName(stream);
      if (stream.pullUrl) txtContent += `${baseName}①,${stream.pullUrl}\n`;
      if (stream.pushUrl) txtContent += `${baseName}②,${stream.pushUrl}\n`;
    });

    return new Response(txtContent, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(`服务器内部错误: ${error.message}`, { status: 500 });
  }
}
